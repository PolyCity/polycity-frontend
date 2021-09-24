import { BigNumber, BigNumberish } from '@ethersproject/bignumber'
import { ChainId, WNATIVE } from '@polycity/sdk'
import { getProviderOrSigner, getSigner } from '../functions/contract'

import { AddressZero } from '@ethersproject/constants'
import { Contract } from '@ethersproject/contracts'
import KUSHOPAIR_ABI from '../constants/abis/kushopair.json'
import { KushoPermit } from '../hooks/useKushoApproveCallback'
import { Web3Provider } from '@ethersproject/providers'
import { ZERO } from '../functions/math'
import { defaultAbiCoder } from '@ethersproject/abi'
import { toElastic } from '../functions/rebase'
import { toShare } from '../functions/antiquebox'

export async function signMasterContractApproval(
  antiqueBoxContract: Contract | null,
  masterContract: string | undefined,
  user: string,
  library: Web3Provider,
  approved: boolean,
  chainId: ChainId | undefined
): Promise<string> {
  const warning = approved
    ? 'Give FULL access to funds in (and approved to) AntiqueBox?'
    : 'Revoke access to AntiqueBox?'
  const nonce = await antiqueBoxContract?.nonces(user)
  const message = {
    warning,
    user,
    masterContract,
    approved,
    nonce,
  }

  const typedData = {
    types: {
      SetMasterContractApproval: [
        { name: 'warning', type: 'string' },
        { name: 'user', type: 'address' },
        { name: 'masterContract', type: 'address' },
        { name: 'approved', type: 'bool' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'SetMasterContractApproval',
    domain: {
      name: 'AntiqueBox V1',
      chainId: chainId,
      verifyingContract: antiqueBoxContract?.address,
    },
    message: message,
  }
  const signer = getSigner(library, user)
  return signer._signTypedData(typedData.domain, typedData.types, typedData.message)
}

enum Action {
  ADD_ASSET = 1,
  REPAY = 2,
  REMOVE_ASSET = 3,
  REMOVE_COLLATERAL = 4,
  BORROW = 5,
  GET_REPAY_SHARE = 6,
  GET_REPAY_PART = 7,
  ACCRUE = 8,

  // Functions that don't need accrue to be called
  ADD_COLLATERAL = 10,
  UPDATE_EXCHANGE_RATE = 11,

  // Function on AntiqueBox
  ANTIQUE_DEPOSIT = 20,
  ANTIQUE_WITHDRAW = 21,
  ANTIQUE_TRANSFER = 22,
  ANTIQUE_TRANSFER_MULTIPLE = 23,
  ANTIQUE_SETAPPROVAL = 24,

  // Any external call (except to AntiqueBox)
  CALL = 30,
}

export default class KushoCooker {
  private pair: any
  private account: string
  private library: Web3Provider | undefined
  private chainId: ChainId

  private actions: Action[]
  private values: BigNumber[]
  private datas: string[]

  constructor(
    pair: any,
    account: string | null | undefined,
    library: Web3Provider | undefined,
    chainId: ChainId | undefined
  ) {
    this.pair = pair
    this.account = account || AddressZero
    this.library = library
    this.chainId = chainId || 1

    this.actions = []
    this.values = []
    this.datas = []
  }

  add(action: Action, data: string, value: BigNumberish = 0): void {
    this.actions.push(action)
    this.datas.push(data)
    this.values.push(BigNumber.from(value))
  }

  approve(permit: KushoPermit): void {
    if (permit) {
      this.add(
        Action.ANTIQUE_SETAPPROVAL,
        defaultAbiCoder.encode(
          ['address', 'address', 'bool', 'uint8', 'bytes32', 'bytes32'],
          [permit.account, permit.masterContract, true, permit.v, permit.r, permit.s]
        )
      )
    }
  }

  updateExchangeRate(mustUpdate = false, minRate = ZERO, maxRate = ZERO): KushoCooker {
    this.add(
      Action.UPDATE_EXCHANGE_RATE,
      defaultAbiCoder.encode(['bool', 'uint256', 'uint256'], [mustUpdate, minRate, maxRate])
    )
    return this
  }

  antiqueDepositCollateral(amount: BigNumber): KushoCooker {
    const useNative = this.pair.collateral.address === WNATIVE[this.chainId].address

    this.add(
      Action.ANTIQUE_DEPOSIT,
      defaultAbiCoder.encode(
        ['address', 'address', 'int256', 'int256'],
        [useNative ? AddressZero : this.pair.collateral.address, this.account, amount, 0]
      ),
      useNative ? amount : ZERO
    )

    return this
  }

  antiqueWithdrawCollateral(amount: BigNumber, share: BigNumber): KushoCooker {
    const useNative = this.pair.collateral.address === WNATIVE[this.chainId].address

    this.add(
      Action.ANTIQUE_WITHDRAW,
      defaultAbiCoder.encode(
        ['address', 'address', 'int256', 'int256'],
        [useNative ? AddressZero : this.pair.collateral.address, this.account, amount, share]
      ),
      useNative ? amount : ZERO
    )

    return this
  }

  antiqueTransferCollateral(share: BigNumber, toAddress: string): KushoCooker {
    this.add(
      Action.ANTIQUE_TRANSFER,
      defaultAbiCoder.encode(['address', 'address', 'int256'], [this.pair.collateral.address, toAddress, share])
    )

    return this
  }

  repayShare(part: BigNumber): KushoCooker {
    this.add(Action.GET_REPAY_SHARE, defaultAbiCoder.encode(['int256'], [part]))

    return this
  }

  addCollateral(amount: BigNumber, fromAntique: boolean): KushoCooker {
    let share: BigNumber
    if (fromAntique) {
      share = amount.lt(0) ? amount : toShare(this.pair.collateral, amount)
    } else {
      const useNative = this.pair.collateral.address === WNATIVE[this.chainId].address

      this.add(
        Action.ANTIQUE_DEPOSIT,
        defaultAbiCoder.encode(
          ['address', 'address', 'int256', 'int256'],
          [useNative ? AddressZero : this.pair.collateral.address, this.account, amount, 0]
        ),
        useNative ? amount : ZERO
      )
      share = BigNumber.from(-2)
    }

    this.add(Action.ADD_COLLATERAL, defaultAbiCoder.encode(['int256', 'address', 'bool'], [share, this.account, false]))
    return this
  }

  addAsset(amount: BigNumber, fromAntique: boolean): KushoCooker {
    let share: BigNumber
    if (fromAntique) {
      share = toShare(this.pair.asset, amount)
    } else {
      const useNative = this.pair.asset.address === WNATIVE[this.chainId].address

      this.add(
        Action.ANTIQUE_DEPOSIT,
        defaultAbiCoder.encode(
          ['address', 'address', 'int256', 'int256'],
          [useNative ? AddressZero : this.pair.asset.address, this.account, amount, 0]
        ),
        useNative ? amount : ZERO
      )
      share = BigNumber.from(-2)
    }

    this.add(Action.ADD_ASSET, defaultAbiCoder.encode(['int256', 'address', 'bool'], [share, this.account, false]))
    return this
  }

  removeAsset(fraction: BigNumber, toAntique: boolean): KushoCooker {
    this.add(Action.REMOVE_ASSET, defaultAbiCoder.encode(['int256', 'address'], [fraction, this.account]))
    if (!toAntique) {
      const useNative = this.pair.asset.address === WNATIVE[this.chainId].address

      this.add(
        Action.ANTIQUE_WITHDRAW,
        defaultAbiCoder.encode(
          ['address', 'address', 'int256', 'int256'],
          [useNative ? AddressZero : this.pair.asset.address, this.account, 0, -1]
        )
      )
    }
    return this
  }

  removeCollateral(share: BigNumber, toAntique: boolean): KushoCooker {
    this.add(Action.REMOVE_COLLATERAL, defaultAbiCoder.encode(['int256', 'address'], [share, this.account]))
    if (!toAntique) {
      const useNative = this.pair.collateral.address === WNATIVE[this.chainId].address

      this.add(
        Action.ANTIQUE_WITHDRAW,
        defaultAbiCoder.encode(
          ['address', 'address', 'int256', 'int256'],
          [useNative ? AddressZero : this.pair.collateral.address, this.account, 0, share]
        )
      )
    }
    return this
  }

  removeCollateralFraction(fraction: BigNumber, toAntique: boolean): KushoCooker {
    this.add(Action.REMOVE_COLLATERAL, defaultAbiCoder.encode(['int256', 'address'], [fraction, this.account]))
    if (!toAntique) {
      const useNative = this.pair.collateral.address === WNATIVE[this.chainId].address

      this.add(
        Action.ANTIQUE_WITHDRAW,
        defaultAbiCoder.encode(
          ['address', 'address', 'int256', 'int256'],
          [useNative ? AddressZero : this.pair.collateral.address, this.account, 0, -1]
        )
      )
    }
    return this
  }

  borrow(amount: BigNumber, toAntique: boolean, toAddress = ''): KushoCooker {
    this.add(
      Action.BORROW,
      defaultAbiCoder.encode(['int256', 'address'], [amount, toAddress && toAntique ? toAddress : this.account])
    )
    if (!toAntique) {
      const useNative = this.pair.asset.address === WNATIVE[this.chainId].address

      this.add(
        Action.ANTIQUE_WITHDRAW,
        defaultAbiCoder.encode(
          ['address', 'address', 'int256', 'int256'],
          [useNative ? AddressZero : this.pair.asset.address, toAddress || this.account, amount, 0]
        )
      )
    }
    return this
  }

  repay(amount: BigNumber, fromAntique: boolean): KushoCooker {
    if (!fromAntique) {
      const useNative = this.pair.asset.address === WNATIVE[this.chainId].address

      this.add(
        Action.ANTIQUE_DEPOSIT,
        defaultAbiCoder.encode(
          ['address', 'address', 'int256', 'int256'],
          [useNative ? AddressZero : this.pair.asset.address, this.account, amount, 0]
        ),
        useNative ? amount : ZERO
      )
    }
    this.add(Action.GET_REPAY_PART, defaultAbiCoder.encode(['int256'], [fromAntique ? amount : -1]))
    this.add(Action.REPAY, defaultAbiCoder.encode(['int256', 'address', 'bool'], [-1, this.account, false]))
    return this
  }

  repayPart(part: BigNumber, fromAntique: boolean): KushoCooker {
    if (!fromAntique) {
      const useNative = this.pair.asset.address === WNATIVE[this.chainId].address

      this.add(Action.GET_REPAY_SHARE, defaultAbiCoder.encode(['int256'], [part]))
      this.add(
        Action.ANTIQUE_DEPOSIT,
        defaultAbiCoder.encode(
          ['address', 'address', 'int256', 'int256'],
          [useNative ? AddressZero : this.pair.asset.address, this.account, 0, -1]
        ),
        // TODO: Put some warning in the UI or not allow repaying ETH directly from wallet, because this can't be pre-calculated
        useNative ? toShare(this.pair.asset, toElastic(this.pair.totalBorrow, part, true)).mul(1001).div(1000) : ZERO
      )
    }
    this.add(Action.REPAY, defaultAbiCoder.encode(['int256', 'address', 'bool'], [part, this.account, false]))
    return this
  }

  action(
    address: string,
    value: BigNumberish,
    data: string,
    useValue1: boolean,
    useValue2: boolean,
    returnValues: number
  ): void {
    this.add(
      Action.CALL,
      defaultAbiCoder.encode(
        ['address', 'bytes', 'bool', 'bool', 'uint8'],
        [address, data, useValue1, useValue2, returnValues]
      ),
      value
    )
  }

  async cook() {
    if (!this.library) {
      return {
        success: false,
      }
    }

    const kushoPairCloneContract = new Contract(
      this.pair.address,
      KUSHOPAIR_ABI,
      getProviderOrSigner(this.library, this.account) as any
    )

    try {
      return {
        success: true,
        tx: await kushoPairCloneContract.cook(this.actions, this.values, this.datas, {
          value: this.values.reduce((a, b) => a.add(b), ZERO),
        }),
      }
    } catch (error) {
      console.error('KushoCooker Error: ', error)
      return {
        success: false,
        error: error,
      }
    }
  }
}
