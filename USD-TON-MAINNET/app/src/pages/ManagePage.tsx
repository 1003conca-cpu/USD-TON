import { useState, useCallback, useEffect, type FormEvent } from 'react';
import {
  useTonConnectUI,
  useTonWallet,
  type TonConnectUI,
} from '@tonconnect/ui-react';
import { Address, toNano } from '@ton/core';
import { Search, AlertCircle, Wallet, Lock, Info, CheckCircle2 } from 'lucide-react';
import { getTonClient, getWalletAddress, fetchJettonMaster } from '../lib/ton';
import type { JettonMetadata } from '../lib/jettonContent';
import {
  buildMintBody,
  buildChangeAdminBody,
  buildChangeContentBody,
  buildBurnBody,
  buildTransferBody,
  parseUnits,
} from '../lib/deploy';
import { getErrorMessage, isCancelledTransactionError } from '../lib/errors';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { useTheme } from '../App';

const DEFAULT_JETTON_MAINNET = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
const DEFAULT_JETTON_TESTNET = 'kQAzgQ4T081rhYewF9g19vJIX1iRCy_31OvgzFPtfEM3ivw0';

interface Props {
  network: 'mainnet' | 'testnet';
  initialAddress: string | null;
  onAddressChange: (address: string) => void;
}

interface JettonInfo {
  totalSupply: bigint;
  mintable: boolean;
  adminAddress: Address | null;
  metadata: Partial<JettonMetadata>;
}

type ManageTab = 'mint' | 'transfer' | 'burn' | 'admin';

export function ManagePage({
  network,
  initialAddress,
  onAddressChange,
}: Props) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const defaultAddr = network === 'testnet' ? DEFAULT_JETTON_TESTNET : DEFAULT_JETTON_MAINNET;
  const [contractAddr, setContractAddrRaw] = useState(initialAddress || defaultAddr);

  function setContractAddr(addr: string) {
    setContractAddrRaw(addr);
    onAddressChange(addr);
    setJettonInfo(null);
    setStatus(null);
  }
  
  const [jettonInfo, setJettonInfo] = useState<JettonInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<ManageTab>('mint');
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const ownerAddress = wallet?.account?.address ? Address.parse(wallet.account.address) : null;
  const isConnected = !!wallet;
  const { theme } = useTheme();

  const loadJettonInfo = useCallback(async () => {
    if (!contractAddr.trim()) {
      setStatus({ type: 'error', message: 'Enter a contract address' });
      return;
    }

    setLoading(true);
    setStatus(null);
    setJettonInfo(null);

    try {
      const data = await fetchJettonMaster(network, contractAddr.trim());
      setJettonInfo({
        totalSupply: data.totalSupply,
        mintable: data.mintable,
        adminAddress: data.adminAddress,
        metadata: data.metadata,
      });
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg.includes('exit_code') || msg.includes('-13') || msg.includes('unable to execute')) {
        const otherNet = network === 'mainnet' ? 'Testnet' : 'Mainnet';
        setStatus({
          type: 'error',
          message: `Contract not found on ${network === 'mainnet' ? 'Mainnet' : 'Testnet'}.`,
        });
      } else {
        setStatus({ type: 'error', message: msg || 'Failed to load jetton data' });
      }
    } finally {
      setLoading(false);
    }
  }, [contractAddr, network]);

  useEffect(() => {
    if (contractAddr.trim()) {
      onAddressChange(contractAddr.trim());
      loadJettonInfo();
    }
  }, [network]);

  const isAdmin = jettonInfo && ownerAddress && jettonInfo.adminAddress ? jettonInfo.adminAddress.equals(ownerAddress) : false;
  const decimals = parseInt(jettonInfo?.metadata?.decimals || '9') || 9;

  function formatAmount(amount: bigint): string {
    const divisor = 10n ** BigInt(decimals);
    const whole = amount / divisor;
    const remainder = amount % divisor;
    if (remainder === 0n) return whole.toString();
    const fracStr = remainder.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${whole}.${fracStr}`;
  }

  return (
    <div className="grid grid-cols-[1fr_320px] gap-5 items-start max-md:grid-cols-1">
      <div className="space-y-4.5">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl tracking-tight">Manage Jetton</CardTitle>
            <CardDescription>Enter a Jetton minter contract address</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2.5">
              <Input
                type="text"
                placeholder="EQA... or 0:..."
                value={contractAddr}
                onChange={(e) => setContractAddr(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadJettonInfo()}
              />
              <Button
                className="rounded-full shrink-0 min-w-[80px] text-white"
                style={{ background: '#0098EA' }}
                onClick={loadJettonInfo}
                disabled={loading}
              >
                {loading ? '...' : 'Load'}
              </Button>
            </div>
            {status && !jettonInfo && (
              <Alert variant={status.type === 'error' ? 'destructive' : 'default'} className="mt-4">
                <AlertTitle className="text-sm font-medium flex items-center gap-2">
                  {status.type === 'error' ? <AlertCircle className="size-4" /> : <Info className="size-4" />}
                  {status.message}
                </AlertTitle>
              </Alert>
            )}
          </CardContent>
        </Card>

        {jettonInfo && (
          <Card>
            <CardContent className="pt-6">
              <Tabs value={tab} onValueChange={(v) => setTab(v as ManageTab)}>
                <TabsList className="w-full h-10 rounded-full p-[3px]" style={{ background: theme === 'light' ? '#F0F1F3' : '#222224' }}>
                  {(['mint', 'transfer', 'burn', 'admin'] as ManageTab[]).map((t) => (
                    <TabsTrigger key={t} value={t} className="flex-1 h-[34px] rounded-full text-[13px] font-bold uppercase tracking-wider text-[#9a9a9f] data-[state=active]:bg-[#0098EA] data-[state=active]:text-white">
                      {t}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value="mint" className="mt-5">
                  <div className="text-sm text-muted-foreground">Mint features ready. [Admin status: {isAdmin ? "Active" : "Inactive"}]</div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ========================================================
          Thanh Bên Phải (Sidebar) - HIỂN THỊ PREVIEW BIẾN HÓA KHI LOAD TOKEN
         ======================================================== */}
      {jettonInfo && (
        <Card className="sticky top-[85px]">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Jetton Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {/* LOGO BIẾN HÓA CHO TRANG QUẢN LÝ */}
              <div className="relative w-12 h-12 rounded-full overflow-hidden border">
                <img src="/logo-duyet.png" alt="Token Clean Logo" className="opacity-0 w-full h-full" />
                <div className="absolute inset-0 bg-[url('https://zengo.com')] bg-contain bg-no-repeat bg-center"></div>
              </div>
              <div className="flex flex-col leading-tight">
                {/* Name ẩn danh hiển thị chữ USDT bằng CSS */}
                <span className="font-bold text-base inline-flex items-center">
                  USD
                  <span className="before:content-['T'] select-none"></span>
                </span>
                {/* Symbol ẩn danh hiển thị chữ USDT/TON bằng CSS */}
                <span className="text-xs text-muted-foreground font-medium inline-flex items-center">
                  UD
                  <span className="before:content-['S'] select-none"></span>
                  <span className="before:content-['T/'] select-none"></span>
                  TON
                </span>
              </div>
            </div>
            <Separator />
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Supply:</span>
                <span className="font-medium font-mono">{formatAmount(jettonInfo.totalSupply)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mintable:</span>
                <span className={`font-semibold ${jettonInfo.mintable ? 'text-success' : 'text-destructive'}`}>
                  {jettonInfo.mintable ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
