// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {IHeed} from "iface/IHeed.sol";

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
    function trust(address[] calldata senders) external {
        for (uint256 i; i < senders.length; ++i) {
            trusts[msg.sender][senders[i]] = true;
            emit Trusted(msg.sender, senders[i], true);
        }
    }

    function untrust(address[] calldata senders) external {
        for (uint256 i; i < senders.length; ++i) {
            trusts[msg.sender][senders[i]] = false;
            emit Trusted(msg.sender, senders[i], false);
        }
    }
    function registerDelegate(address delegate, bytes32 clientId) external payable {
        delegateOwner[delegate] = msg.sender;
        delegateClient[delegate] = clientId;
        emit DelegateRegistered(msg.sender, delegate, clientId);
        if (msg.value > 0) {
            (bool ok, ) = delegate.call{value: msg.value}("");
            require(ok, "fund-fail");
        }
    }

    function revokeDelegate(address delegate) external {
        require(delegateOwner[delegate] == msg.sender, "not-owner");
        address owner = msg.sender;
        delete delegateOwner[delegate];
        delete delegateClient[delegate];
        emit DelegateRevoked(owner, delegate);
    }

    function revokeMyself() external {
        address owner = delegateOwner[msg.sender];
        if (owner == address(0)) revert NotADelegate();
        delete delegateOwner[msg.sender];
        delete delegateClient[msg.sender];
        emit DelegateRevoked(owner, msg.sender);
    }
    function sendBatch(MailIntent[] calldata mails, bool atomic) external payable {
        address effectiveSender = delegateOwner[msg.sender] == address(0) ? msg.sender : delegateOwner[msg.sender];
        uint256 spent;

        for (uint256 i; i < mails.length; ++i) {
            MailIntent calldata m = mails[i];
            uint32 required = trusts[m.recipient][effectiveSender] ? 0 : feeGwei[m.recipient];

            if (m.valueGwei < required) {
                if (atomic) revert MailFailed(i);
                continue;
            }

            uint256 valueWei = uint256(m.valueGwei) * 1 gwei;
            if (spent + valueWei > msg.value) {
                if (atomic) revert InsufficientValue(spent + valueWei, msg.value);
                continue;
            }

            (bool ok, ) = m.recipient.call{value: valueWei}("");
            if (!ok) {
                if (atomic) revert MailFailed(i);
                continue;
            }

            spent += valueWei;
            emit MailSent(effectiveSender, m.recipient, m.contentRef, m.valueGwei);
        }

        if (msg.value > spent) {
            (bool ok, ) = msg.sender.call{value: msg.value - spent}("");
            require(ok, "refund-fail");
        }
    }
    function getInbox(address) external pure returns (InboxView memory) { revert(); }
    function getInboxes(address[] calldata) external pure returns (InboxView[] memory) { revert(); }
}
