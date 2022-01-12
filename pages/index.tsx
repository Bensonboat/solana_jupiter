import type { NextPage } from 'next'
import { Wallet } from './WalletProvider'

const Home: NextPage = () => {
  return (
    <div>
      <Wallet></Wallet>
    </div>
  )
}

export default Home
