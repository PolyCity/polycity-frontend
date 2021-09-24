import { Direction, TransactionReview } from '../../entities/TransactionReview'
import { KushoApproveButton, TokenApproveButton } from './Button'
import React, { useState } from 'react'
import { ZERO, e10 } from '../../functions/math'

import Button from '../../components/Button'
import KushoCooker from '../../entities/KushoCooker'
import SmartNumberInput from './SmartNumberInput'
import TransactionReviewList from './TransactionReview'
import { WNATIVE } from '@polycity/sdk'
import { Warnings } from '../../entities/Warnings'
import WarningsList from './WarningsList'
import { formatNumber } from '../../functions/format'
import { t } from '@lingui/macro'
import { useActiveWeb3React } from '../../hooks/useActiveWeb3React'
import { useCurrency } from '../../hooks/Tokens'
import { useKushoInfo } from './context'
import { useLingui } from '@lingui/react'

export default function Deposit({ pair }: any): JSX.Element {
  const { chainId } = useActiveWeb3React()
  const assetToken = useCurrency(pair.asset.address) || undefined

  const { i18n } = useLingui()

  // State
  const [useAntique, setUseAntique] = useState<boolean>(pair.asset.antiqueBalance.gt(0))
  const [value, setValue] = useState('')

  const info = useKushoInfo()

  // Calculated
  const assetNative = WNATIVE[chainId || 1].address === pair.asset.address
  const balance = useAntique ? pair.asset.antiqueBalance : assetNative ? info?.ethBalance : pair.asset.balance

  const max = useAntique ? pair.asset.antiqueBalance : assetNative ? info?.ethBalance : pair.asset.balance

  const warnings = new Warnings()

  warnings.add(
    balance?.lt(value.toBigNumber(pair.asset.tokenInfo.decimals)),
    i18n._(
      t`Please make sure your ${
        useAntique ? 'AntiqueBox' : 'wallet'
      } balance is sufficient to deposit and then try again.`
    ),
    true
  )

  const transactionReview = new TransactionReview()

  if (value && !warnings.broken) {
    const amount = value.toBigNumber(pair.asset.tokenInfo.decimals)
    const newUserAssetAmount = pair.currentUserAssetAmount.value.add(amount)
    transactionReview.addTokenAmount(
      i18n._(t`Balance`),
      pair.currentUserAssetAmount.value,
      newUserAssetAmount,
      pair.asset
    )
    transactionReview.addUSD(i18n._(t`Balance USD`), pair.currentUserAssetAmount.value, newUserAssetAmount, pair.asset)
    const newUtilization = e10(18).mulDiv(pair.currentBorrowAmount.value, pair.currentAllAssets.value.add(amount))
    transactionReview.addPercentage(i18n._(t`Borrowed`), pair.utilization.value, newUtilization)
    if (pair.currentExchangeRate.isZero()) {
      transactionReview.add(
        'Exchange Rate',
        formatNumber(
          pair.currentExchangeRate.toFixed(18 + pair.collateral.tokenInfo.decimals - pair.asset.tokenInfo.decimals)
        ),
        formatNumber(
          pair.oracleExchangeRate.toFixed(18 + pair.collateral.tokenInfo.decimals - pair.asset.tokenInfo.decimals)
        ),
        Direction.UP
      )
    }
    transactionReview.addPercentage(i18n._(t`Supply APR`), pair.supplyAPR.value, pair.currentSupplyAPR.value)
  }

  // Handlers
  async function onExecute(cooker: KushoCooker): Promise<string> {
    if (pair.currentExchangeRate.isZero()) {
      cooker.updateExchangeRate(false, ZERO, ZERO)
    }
    cooker.addAsset(value.toBigNumber(pair.asset.tokenInfo.decimals), useAntique)
    return `${i18n._(t`Deposit`)} ${pair.asset.tokenInfo.symbol}`
  }

  return (
    <>
      <div className="mt-6 text-3xl text-high-emphesis">Deposit {pair.asset.tokenInfo.symbol}</div>

      <SmartNumberInput
        color="blue"
        token={pair.asset}
        value={value}
        setValue={setValue}
        useAntiqueTitleDirection="down"
        useAntiqueTitle="from"
        useAntique={useAntique}
        setUseAntique={setUseAntique}
        maxTitle="Balance"
        max={max}
        showMax={true}
      />

      <WarningsList warnings={warnings} />
      <TransactionReviewList transactionReview={transactionReview} />

      <KushoApproveButton
        color="blue"
        content={(onCook: any) => (
          <TokenApproveButton value={value} token={assetToken} needed={!useAntique}>
            <Button
              onClick={() => onCook(pair, onExecute)}
              disabled={value.toBigNumber(pair.asset.tokenInfo.decimals).lte(0) || warnings.broken}
            >
              {i18n._(t`Deposit`)}
            </Button>
          </TokenApproveButton>
        )}
      />
    </>
  )
}
