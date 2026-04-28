// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

interface IHeed {
    struct EncKey {
        uint32  keyNonce;
        uint64  publishedAt;
        bytes32 pub;
    }

    struct MailIntent {
        address recipient;
        uint32  valueGwei;
        bytes32 contentRef;
    }

    struct InboxView {
        uint32    feeGwei;
        EncKey[2] keys;
    }

    event KeyPublished(address indexed owner, uint32 keyNonce, bytes32 pub);
    event FeeUpdated(address indexed recipient, uint32 valueGwei);
    event Trusted(address indexed recipient, address indexed sender, bool trusted);
    event DelegateRegistered(address indexed owner, address indexed delegate, bytes32 clientId);
    event DelegateRevoked(address indexed owner, address indexed delegate);
    event MailSent(
        address indexed sender,
        address indexed recipient,
        bytes32 contentRef,
        uint32  valueGwei
    );

    error FeeAboveCap(uint32 valueGwei, uint32 cap);
    error KeyNonceNotMonotonic(uint32 provided, uint32 highest);
    error NotADelegate();
    error InsufficientValue(uint256 sumOfValues, uint256 msgValue);
    error MailFailed(uint256 index);

    function MAX_FEE_GWEI() external view returns (uint32);
    function publishKey(uint32 keyNonce, bytes32 pub) external;
    function getKeys(address owner) external view returns (EncKey[2] memory);
    function setFee(uint32 valueGwei) external;
    function feeGwei(address) external view returns (uint32);
    function trust(address[] calldata senders) external;
    function untrust(address[] calldata senders) external;
    function trusts(address recipient, address sender) external view returns (bool);
    function registerDelegate(address delegate, bytes32 clientId) external payable;
    function revokeDelegate(address delegate) external;
    function revokeMyself() external;
    function delegateOwner(address delegate) external view returns (address);
    function delegateClient(address delegate) external view returns (bytes32);
    function sendBatch(MailIntent[] calldata mails, bool atomic) external payable;
    function getInbox(address addr) external view returns (InboxView memory);
    function getInboxes(address[] calldata addrs) external view returns (InboxView[] memory);
}
