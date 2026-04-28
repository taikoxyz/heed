// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {IHeed} from "./interfaces/IHeed.sol";

contract Heed is IHeed {
    uint32 public immutable MAX_FEE_GWEI;

    mapping(address => EncKey[2])                       internal  _keys;
    mapping(address => uint32)                          public    feeGwei;
    mapping(address => mapping(address => bool))        public    trusts;
    mapping(address => address)                         public    delegateOwner;
    mapping(address => bytes32)                         public    delegateClient;

    constructor(uint32 maxFeeGwei) {
        MAX_FEE_GWEI = maxFeeGwei;
    }

    function publishKey(uint32 keyNonce, bytes32 pub) external {
        if (pub == bytes32(0)) revert EmptyPubKey();
        EncKey[2] storage slots = _keys[msg.sender];
        uint32 highest = slots[0].keyNonce > slots[1].keyNonce ? slots[0].keyNonce : slots[1].keyNonce;
        bool firstEverSlot = slots[0].pub == bytes32(0) && slots[1].pub == bytes32(0);
        if (!firstEverSlot && keyNonce <= highest) revert KeyNonceNotMonotonic(keyNonce, highest);

        uint8 victim;
        if (slots[0].pub == bytes32(0)) {
            victim = 0;
        } else if (slots[1].pub == bytes32(0)) {
            victim = 1;
        } else {
            victim = slots[0].keyNonce <= slots[1].keyNonce ? 0 : 1;
        }
        slots[victim] = EncKey({keyNonce: keyNonce, publishedAt: uint64(block.timestamp), pub: pub});
        emit KeyPublished(msg.sender, keyNonce, pub);
    }

    function getKeys(address owner) external view returns (EncKey[2] memory) {
        return _keys[owner];
    }

    function setFee(uint32 valueGwei) external {
        if (valueGwei > MAX_FEE_GWEI) revert FeeAboveCap(valueGwei, MAX_FEE_GWEI);
        feeGwei[msg.sender] = valueGwei;
        emit FeeUpdated(msg.sender, valueGwei);
    }
    function trust(address[] calldata) external pure { revert(); }
    function untrust(address[] calldata) external pure { revert(); }
    function registerDelegate(address, bytes32) external payable { revert(); }
    function revokeDelegate(address) external pure { revert(); }
    function revokeMyself() external pure { revert(); }
    function sendBatch(MailIntent[] calldata, bool) external payable { revert(); }
    function getInbox(address) external pure returns (InboxView memory) { revert(); }
    function getInboxes(address[] calldata) external pure returns (InboxView[] memory) { revert(); }
}
