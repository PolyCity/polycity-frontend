import gql from 'graphql-tag'

export const antiqueTokenFieldsQuery = gql`
  fragment antiqueTokenFields on Token {
    id
    # antiqueBox
    name
    symbol
    decimals
    totalSupplyElastic
    totalSupplyBase
    block
    timestamp
  }
`

export const antiqueUserTokensQuery = gql`
  query antiqueUserTokens($user: String!, $skip: Int = 0, $first: Int = 1000, $block: Block_height) {
    userTokens(skip: $skip, first: $first, block: $block, where: { share_gt: 0, user: $user }) {
      token {
        ...antiqueTokenFields
      }
      share
    }
  }
  ${antiqueTokenFieldsQuery}
`

export const kushoPairFieldsQuery = gql`
  fragment kushoPairFields on KushoPair {
    id
    # antiqueBox
    type
    masterContract
    owner
    feeTo
    name
    symbol
    oracle
    asset {
      ...antiqueTokenFields
    }
    collateral {
      ...antiqueTokenFields
    }
    exchangeRate
    totalAssetElastic
    totalAssetBase
    totalCollateralShare
    totalBorrowElastic
    totalBorrowBase
    interestPerSecond
    utilization
    feesEarnedFraction
    totalFeesEarnedFraction
    lastAccrued
    supplyAPR
    borrowAPR
    # transactions
    # users
    block
    timestamp
  }
  ${antiqueTokenFieldsQuery}
`

export const kushoPairsQuery = gql`
  query kushoPairs(
    $skip: Int = 0
    $first: Int = 1000
    $where: KushoPair_filter
    $block: Block_height
    $orderBy: KushoPair_orderBy = "utilization"
    $orderDirection: OrderDirection! = "desc"
  ) {
    kushoPairs(
      skip: $skip
      first: $first
      where: $where
      block: $block
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      ...kushoPairFields
    }
  }
  ${kushoPairFieldsQuery}
`

export const kushoUserPairsQuery = gql`
  query kushoUserPairs($user: String!, $skip: Int = 0, $first: Int = 1000, $block: Block_height) {
    userKushoPairs(skip: $skip, first: $first, block: $block, where: { user: $user }) {
      assetFraction
      collateralShare
      borrowPart
      pair {
        ...kushoPairFields
      }
    }
  }
  ${kushoPairFieldsQuery}
`
