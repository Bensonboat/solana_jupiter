import { JupiterProvider } from '@jup-ag/react-hook';
import { Connection } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
// const connection = new Connection('https://solana-api.projectserum.com');
const connection = new Connection('https://api.testnet.solana.com');

//@ts-ignore
const Jupiter = ({ children }) => {
  const wallet = useWallet() // user wallet
  return (
    //@ts-ignore
    <JupiterProvider connection={connection} cluster="mainnet-beta" userPublicKey={wallet.publicKey}>
      {children}
    </JupiterProvider>

  )
}

// const Jupiter = () => {
//   return <div>Hi Jupiter</div>
{/* <JupiterProvider connection={connection} cluster="mainnet-beta" userPublicKey={wallet.publicKey}> */}
// }

export default Jupiter