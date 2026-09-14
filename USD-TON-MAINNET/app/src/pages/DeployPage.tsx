import { useState, type FormEvent } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { Address, toNano, beginCell, storeStateInit } from '@ton/core';
import { AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { buildDeployMessage, parseUnits } from '../lib/deploy';
import { getErrorMessage, isCancelledTransactionError } from '../lib/errors';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle } from '@/components/ui/alert';

interface Props {
  network: 'mainnet' | 'testnet';
}

export function DeployPage({ network }: Props) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [name, setName] = useState('USD-TON');
  const [symbol, setSymbol] = useState('TON/USDT');
  const [decimals, setDecimals] = useState('9');
  const [description, setDescription] = useState(
    'Internal project token on the TON blockchain. Not affiliated with Tether, OKX, or TON Foundation.',
  );
  const [imageUrl, setImageUrl] = useState('');
  const [mintAmount, setMintAmount] = useState('1000000');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);

  const ownerAddress = wallet?.account?.address ? Address.parse(wallet.account.address) : null;
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
      const metadata = {
        name: name.trim() || 'USD-TON',
        symbol: symbol.trim() || 'TON/USDT',
        decimals,
        description: description.trim(),
        image: imageUrl.trim(),
      };

      const { contractAddress, stateInit, mintBody } = await buildDeployMessage({
        metadata,
        ownerAddress,
        mintAmount: mintAmountNano,
      });

      setStatus({ type: 'info', message: 'Confirm the transaction in your wallet...' });

      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        network: network === 'mainnet' ? '-239' : '-3',
        messages: [
          {
            address: contractAddress.toString(),
            amount: toNano('0.15').toString(),
            stateInit: beginCell().store(storeStateInit(stateInit)).endCell().toBoc().toString('base64'),
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
      setStatus({
        type: 'error',
        message: isCancelledTransactionError(err)
          ? 'Transaction cancelled'
          : getErrorMessage(err) || 'Deployment failed',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-[1fr_320px] gap-5 items-start max-md:grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl tracking-tight">Deploy New Jetton</CardTitle>
          <CardDescription>
            Create an internal project Jetton on {network === 'mainnet' ? 'TON Mainnet' : 'TON Testnet'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDeploy} className="space-y-4.5">
            <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
              <Field label="Token Name"><Input value={name} onChange={(e) => setName(e.target.value)} disabled={loading} /></Field>
              <Field label="Symbol"><Input value={symbol} onChange={(e) => setSymbol(e.target.value)} disabled={loading} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
              <Field label="Decimals"><Input type="number" min="0" max="18" value={decimals} onChange={(e) => setDecimals(e.target.value)} disabled={loading} /></Field>
              <Field label="Initial Supply"><Input value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} disabled={loading} /></Field>
            </div>
            <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={loading} /></Field>
            <Field label="Image URL"><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} disabled={loading} placeholder="https://example.com/logo.png" /></Field>

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
                  <div className="flex items-center gap-2"><CheckCircle2 className="size-4" />Jetton deployed</div>
                  <div className="font-mono text-xs break-all select-all">{deployedAddress}</div>
                </AlertTitle>
              </Alert>
            )}

            <Button type="submit" className="w-full font-bold h-11 text-[15px]" disabled={loading}>
              {loading ? 'Processing...' : isConnected ? 'Deploy Jetton' : 'Connect Wallet'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="sticky top-[85px]">
        <CardHeader>
          <CardTitle className="text-base">Project preview</CardTitle>
          <CardDescription>Reference information only. No public market price is implied.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between gap-4"><span className="text-muted-foreground">Name</span><span className="font-medium">{name || '—'}</span></div>
          <div className="flex justify-between gap-4"><span className="text-muted-foreground">Symbol</span><span className="font-medium">{symbol || '—'}</span></div>
          <div className="flex justify-between gap-4"><span className="text-muted-foreground">Network</span><span className="font-medium">{network}</span></div>
          <p className="text-xs text-muted-foreground leading-relaxed">Internal project token. Not affiliated with Tether, OKX, or TON Foundation.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
      {children}
    </div>
  );
}
