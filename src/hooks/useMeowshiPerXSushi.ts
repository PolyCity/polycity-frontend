import { useEffect, useState } from 'react'

import { BigNumber } from '@ethersproject/bignumber'
import { XPICHI } from '../config/tokens'
import { useAntiqueBoxContract } from './useContract'

export default function useMeowshiPerXPichi() {
  const antiqueboxContract = useAntiqueBoxContract()
  const [state, setState] = useState<[BigNumber, BigNumber]>([BigNumber.from('0'), BigNumber.from('0')])

  useEffect(() => {
    if (!antiqueboxContract) return
    ;(async () => {
      const toShare = await antiqueboxContract.toShare(XPICHI.address, '1'.toBigNumber(XPICHI.decimals), false)
      const toAmount = await antiqueboxContract.toAmount(XPICHI.address, '1'.toBigNumber(XPICHI.decimals), false)
      setState([toShare, toAmount])
    })()
  }, [antiqueboxContract])

  return state
}
