import { BigNumber } from '@ethersproject/bignumber'

export function toAmount(token, shares: BigNumber): BigNumber {
  return shares.mulDiv(token.antiqueAmount, token.antiqueShare)
}

export function toShare(token, amount: BigNumber): BigNumber {
  return amount.mulDiv(token.antiqueShare, token.antiqueAmount)
}
