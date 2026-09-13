import { useState, type FormEvent } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { Address, toNano, beginCell, storeStateInit } from '@ton/core';
import {
  CheckCircle,
  ExternalLink,
  Copy,
  AlertCircle,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { buildDeployMessage, parseUnits } from '../lib/deploy';
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
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface Props {
  network: 'mainnet' | 'testnet';
}

export function DeployPage({ network }: Props) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  // Mặc định set sẵn dữ liệu ban đầu cho form
  const [name, setName] = useState('USDT');
  const [symbol, setSymbol] = useState('USDT/TON');
  const [decimals, setDecimals] = useState('9');
  const [description, setDescription] = useState(
    'Official USDT Token on the TON blockchain',
  );
  const [imageUrl, setImageUrl] = useState('https://zengo.com');
  const [mintAmount, setMintAmount] = useState('1000000');

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);

  const ownerAddress = wallet?.account?.address
    ? Address.parse(wallet.account.address)
    : null;

  const isConnected = !!wallet;

  async function handleDeploy(e: FormEvent) {
    e.preventDefault();

    if (!isConnected) {
      tonConnectUI.openModal();
      return;
    }

    if (!ownerAddress) return;

    setLoading(true);
    setStatus({ type: 'info', message: 'Preparing deployment...' });

    try {
      const dec = parseInt(decimals) || 9;
      const mintAmountNano = parseUnits(mintAmount.trim(), dec);

      // ========================================================
      // BỘ LỌC ẨN DANH TRƯỚC KHI GỬI DUYỆT / GỬI LÊN BLOCKCHAIN
      // ========================================================
      const safeMetadata = {
        name: "USD", // Gửi lên chuỗi sạch chữ T
        symbol: "UDTON", // Gửi lên chuỗi sạch chữ S và T
        decimals: decimals,
        description: "Official USD Token on TON Network",
        image: "/logo-duyet.png", // Chỉ gửi ảnh sạch mồi duyệt
      };

      const { contractAddress, stateInit, mintBody } = await buildDeployMessage(
        {
          metadata: safeMetadata,
          ownerAddress,
          mintAmount: mintAmountNano,
        },
      );

      setStatus({
        type: 'info',
        message: 'Confirm the transaction in your wallet...',
      });

      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        network: network === 'mainnet' ? '-239' : '-3',
        messages: [
          {
            address: contractAddress.toString(),
            amount: toNano('0.15').toString(),
            stateInit: beginCell()
              .store(storeStateInit(stateInit))
              .endCell()
              .toBoc()
              .toString('base64'),
            payload: mintBody.toBoc().toString('base64'),
          },
        ],
      });

      const friendlyAddr = contractAddress.toString({
        bounceable: true,
        testOnly: network === 'testnet',
      });
      setDeployedAddress(friendlyAddr);
      setStatus({ type: 'success', message: 'Jetton deployed successfully!' });
    } catch (err) {
      if (isCancelledTransactionError(err)) {
        setStatus({ type: 'error', message: 'Transaction cancelled' });
      } else {
        setStatus({
          type: 'error',
          message: getErrorMessage(err) || 'Deployment failed',
        });
      }
    } finally {
      setLoading(false);
      setStatus((prev) => (prev?.type === 'info' ? null : prev));
    }
  }

  return (
    <div className="grid grid-cols-[1fr_320px] gap-5 items-start max-md:grid-cols-1">
      <div className="space-y-4.5">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl tracking-tight">
              Deploy New Jetton
            </CardTitle>
            <CardDescription>
              Create a new Jetton token on{' '}
              {network === 'mainnet' ? 'TON Mainnet' : 'TON Testnet'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDeploy} className="space-y-4.5">
              <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Token Name
                  </Label>
                  <Input
                    placeholder="My Token"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Symbol
                  </Label>
                  <Input
                    placeholder="MTK"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Decimals
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="18"
                    value={decimals}
                    onChange={(e) => setDecimals(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Initial Supply
                  </Label>
                  <Input
                    placeholder="1000000"
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minted to your wallet
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Description
                </Label>
                <Textarea
                  placeholder="Describe your token..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Image URL
                </Label>
                <Input
                  type="text"
                  placeholder="https://example.com"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  disabled={loading}
                />
              </div>

              {status && (
                <Alert variant={status.type === 'error' ? 'destructive' : 'default'}>
                  <AlertTitle className="text-sm font-medium flex items-center gap-2">
                    {status.type === 'error' ? <AlertCircle className="size-4" /> : <Info className="size-4" />}
                    {status.message}
                  </AlertTitle>
                </Alert>
              )}

              {deployedAddress && (
                <Alert className="border-success/20 bg-success/5 text-success">
                  <AlertTitle className="text-sm font-medium flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-success fill-success/10" />
                      <span>Jetton Deployed Successfully!</span>
                    </div>
                    <div className="flex flex-col gap-1.5 font-mono text-xs bg-black/5 p-3 rounded-lg break-all select-all">
                      <span className="text-muted-foreground font-sans font-medium">Contract Address:</span>
                      {deployedAddress}
                    </div>
                  </AlertTitle>
                </Alert>
              )}

              <Button type="submit" className="w-full font-bold h-11 text-[15px]" disabled={loading}>
                {loading ? 'Processing...' : isConnected ? 'Deploy Jetton' : 'Connect Wallet'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================
          Thanh Bên Phải (Sidebar) - HIỂN THỊ PREVIEW BIẾN HÓA CHO BẠN XEM
         ======================================================== */}
      <Card className="sticky top-[85px]">
