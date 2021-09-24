import { BigNumber } from '@ethersproject/bignumber'
import { getAddress } from '@ethersproject/address'
import { AddressZero } from '@ethersproject/constants'
import { WNATIVE_ADDRESS } from '@polycity/sdk'
import { useActiveWeb3React } from './useActiveWeb3React'
import { useAntiqueBoxContract } from './useContract'
import { useCallback } from 'react'
import { useTransactionAdder } from '../state/transactions/hooks'

function useAntiqueBox() {
  const { account, chainId } = useActiveWeb3React()

  const addTransaction = useTransactionAdder()
  const antiqueBoxContract = useAntiqueBoxContract()

  const deposit = useCallback(
    async (tokenAddress: string, value: BigNumber) => {
      if (value && chainId) {
        try {
          const tokenAddressChecksum = getAddress(tokenAddress)
          if (tokenAddressChecksum === WNATIVE_ADDRESS[chainId]) {
            const tx = await antiqueBoxContract?.deposit(AddressZero, account, account, value, 0, {
              value,
            })
            return addTransaction(tx, { summary: 'Deposit to Antiquebox' })
          } else {
            const tx = await antiqueBoxContract?.deposit(tokenAddressChecksum, account, account, value, 0)
            return addTransaction(tx, { summary: 'Deposit to Antiquebox' })
          }
        } catch (e) {
          console.error('antiquebox deposit error:', e)
          return e
        }
      }
    },
    [account, addTransaction, antiqueBoxContract, chainId]
  )

  const withdraw = useCallback(
    // todo: this should be updated with BigNumber as opposed to string
    async (tokenAddress: string, value: BigNumber) => {
      if (value && chainId) {
        try {
          const tokenAddressChecksum = getAddress(tokenAddress)
          const tx = await antiqueBoxContract?.withdraw(
            tokenAddressChecksum === WNATIVE_ADDRESS[chainId]
              ? '0x0000000000000000000000000000000000000000'
              : tokenAddressChecksum,
            account,
            account,
            value,
            0
          )
          return addTransaction(tx, { summary: 'Withdraw from Antiquebox' })
        } catch (e) {
          console.error('antiquebox withdraw error:', e)
          return e
        }
      }
    },
    [account, addTransaction, antiqueBoxContract, chainId]
  )

  return { deposit, withdraw }
}

export default useAntiqueBox
