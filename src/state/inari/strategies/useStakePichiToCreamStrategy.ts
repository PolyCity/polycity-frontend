import { CRXPICHI, PICHI, XPICHI } from '../../../config/tokens'
import { ChainId, CurrencyAmount, PICHI_ADDRESS, Token } from '@polycity/sdk'
import { StrategyGeneralInfo, StrategyHook, StrategyTokenDefinitions } from '../types'
import { useActiveWeb3React, useApproveCallback, useInariContract, useZenkoContract } from '../../../hooks'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { I18n } from '@lingui/core'
import { t } from '@lingui/macro'
import { tryParseAmount } from '../../../functions'
import useBaseStrategy from './useBaseStrategy'
import { useDerivedInariState } from '../hooks'
import { useLingui } from '@lingui/react'
import { useTokenBalances } from '../../wallet/hooks'

export const GENERAL = (i18n: I18n): StrategyGeneralInfo => ({
  name: i18n._(t`PICHI → Cream`),
  steps: [i18n._(t`PICHI`), i18n._(t`xPICHI`), i18n._(t`Cream`)],
  zapMethod: 'stakePichiToCream',
  unzapMethod: 'unstakePichiFromCream',
  description: i18n._(
    t`Stake PICHI for xPICHI and deposit into Cream in one click. xPICHI in Cream (crXPICHI) can be lent or used as collateral for borrowing.`
  ),
  inputSymbol: i18n._(t`PICHI`),
  outputSymbol: i18n._(t`xPICHI in Cream`),
})

export const tokenDefinitions: StrategyTokenDefinitions = {
  inputToken: {
    chainId: ChainId.MAINNET,
    address: PICHI_ADDRESS[ChainId.MAINNET],
    decimals: 18,
    symbol: 'PICHI',
  },
  outputToken: {
    chainId: ChainId.MAINNET,
    address: '0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272',
    decimals: 18,
    symbol: 'XPICHI',
  },
}

const useStakePichiToCreamStrategy = (): StrategyHook => {
  const { i18n } = useLingui()
  const { account } = useActiveWeb3React()
  const { zapIn, inputValue } = useDerivedInariState()
  const zenkoContract = useZenkoContract()
  const inariContract = useInariContract()
  const balances = useTokenBalances(account, [PICHI[ChainId.MAINNET], CRXPICHI])
  const cTokenAmountRef = useRef<CurrencyAmount<Token>>(null)
  const approveAmount = useMemo(() => (zapIn ? inputValue : cTokenAmountRef.current), [inputValue, zapIn])

  // Override approveCallback for this strategy as we need to approve CRXPICHI on zapOut
  const approveCallback = useApproveCallback(approveAmount, inariContract?.address)
  const general = useMemo(() => GENERAL(i18n), [i18n])
  const { execute, setBalances, ...baseStrategy } = useBaseStrategy({
    id: 'stakePichiToCreamStrategy',
    general,
    tokenDefinitions,
  })

  const toCTokenAmount = useCallback(
    async (val: CurrencyAmount<Token>) => {
      if (!zenkoContract || !val) return null

      const bal = await zenkoContract.toCtoken(CRXPICHI.address, val.quotient.toString())
      return CurrencyAmount.fromRawAmount(CRXPICHI, bal.toString())
    },
    [zenkoContract]
  )

  // Run before executing transaction creation by transforming from xPICHI value to crXPICHI value
  // As you will be spending crXPICHI when unzapping from this strategy
  const preExecute = useCallback(
    async (val: CurrencyAmount<Token>) => {
      if (zapIn) return execute(val)
      return execute(await toCTokenAmount(val))
    },
    [execute, toCTokenAmount, zapIn]
  )

  useEffect(() => {
    toCTokenAmount(inputValue).then((val) => (cTokenAmountRef.current = val))
  }, [inputValue, toCTokenAmount])

  useEffect(() => {
    if (!zenkoContract || !balances) return

    const main = async () => {
      if (!balances[CRXPICHI.address]) return tryParseAmount('0', XPICHI)
      const bal = await zenkoContract.fromCtoken(
        CRXPICHI.address,
        balances[CRXPICHI.address].toFixed().toBigNumber(CRXPICHI.decimals).toString()
      )
      setBalances({
        inputTokenBalance: balances[PICHI[ChainId.MAINNET].address],
        outputTokenBalance: CurrencyAmount.fromRawAmount(XPICHI, bal.toString()),
      })
    }

    main()
  }, [balances, setBalances, zenkoContract])

  return useMemo(
    () => ({
      ...baseStrategy,
      approveCallback: [...approveCallback, approveAmount],
      setBalances,
      execute: preExecute,
    }),
    [approveAmount, approveCallback, baseStrategy, preExecute, setBalances]
  )
}

export default useStakePichiToCreamStrategy
