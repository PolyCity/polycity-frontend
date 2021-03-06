import React, { FC, useCallback } from 'react'
import { useDerivedLimitOrderInfo, useLimitOrderActionHandlers } from '../../../state/limit-order/hooks'

import { AppDispatch } from '../../../state'
import { Field } from '../../../state/swap/actions'
import Typography from '../../../components/Typography'
import { maxAmountSpend } from '../../../functions'
import { setFromAntiqueBalance } from '../../../state/limit-order/actions'
import { t } from '@lingui/macro'
import { useDispatch } from 'react-redux'
import { useLingui } from '@lingui/react'

const BalancePanel: FC = () => {
  const { i18n } = useLingui()
  const { walletBalances, antiqueboxBalances, currencies } = useDerivedLimitOrderInfo()
  const { onUserInput } = useLimitOrderActionHandlers()
  const maxAmountInput = maxAmountSpend(walletBalances[Field.INPUT])
  const dispatch = useDispatch<AppDispatch>()

  const handleMaxInput = useCallback(
    (antique) => {
      if (antique) {
        onUserInput(Field.INPUT, antiqueboxBalances[Field.INPUT].toExact())
        dispatch(setFromAntiqueBalance(true))
      } else {
        maxAmountInput && onUserInput(Field.INPUT, maxAmountInput.toExact())
        dispatch(setFromAntiqueBalance(false))
      }
    },
    [antiqueboxBalances, dispatch, maxAmountInput, onUserInput]
  )

  return (
    <div className="grid grid-cols-2 bg-dark-700 rounded-b px-5 py-1">
      <div className="flex gap-2">
        <Typography variant="sm" weight={700}>
          {i18n._(t`In Antique:`)}
        </Typography>
        <Typography variant="sm" className="text-secondary" onClick={() => handleMaxInput(true)}>
          {antiqueboxBalances[Field.INPUT]?.toSignificant(6, { groupSeparator: ',' })} {currencies[Field.INPUT]?.symbol}
        </Typography>
      </div>
      <div className="flex gap-2">
        <Typography variant="sm" weight={700}>
          {i18n._(t`In Wallet:`)}
        </Typography>
        <Typography variant="sm" className="text-secondary" onClick={() => handleMaxInput(false)}>
          {walletBalances[Field.INPUT]?.toSignificant(6, { groupSeparator: ',' })} {currencies[Field.INPUT]?.symbol}
        </Typography>
      </div>
    </div>
  )
}

export default BalancePanel
