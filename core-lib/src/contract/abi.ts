export const HEED_ABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "maxFeeGwei",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "MAX_FEE_GWEI",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "delegateClient",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "delegateOwner",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "feeGwei",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getInbox",
    "inputs": [
      {
        "name": "addr",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IHeed.InboxView",
        "components": [
          {
            "name": "feeGwei",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "keys",
            "type": "tuple[2]",
            "internalType": "struct IHeed.EncKey[2]",
            "components": [
              {
                "name": "keyNonce",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "publishedAt",
                "type": "uint64",
                "internalType": "uint64"
              },
              {
                "name": "pub",
                "type": "bytes32",
                "internalType": "bytes32"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getInboxes",
    "inputs": [
      {
        "name": "addrs",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "outputs": [
      {
        "name": "out",
        "type": "tuple[]",
        "internalType": "struct IHeed.InboxView[]",
        "components": [
          {
            "name": "feeGwei",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "keys",
            "type": "tuple[2]",
            "internalType": "struct IHeed.EncKey[2]",
            "components": [
              {
                "name": "keyNonce",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "publishedAt",
                "type": "uint64",
                "internalType": "uint64"
              },
              {
                "name": "pub",
                "type": "bytes32",
                "internalType": "bytes32"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getKeys",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[2]",
        "internalType": "struct IHeed.EncKey[2]",
        "components": [
          {
            "name": "keyNonce",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "publishedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "pub",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "publishKey",
    "inputs": [
      {
        "name": "keyNonce",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "pub",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "registerDelegate",
    "inputs": [
      {
        "name": "delegate",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "clientId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "v",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "r",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "s",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "revokeDelegate",
    "inputs": [
      {
        "name": "delegate",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "revokeMyself",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "sendBatch",
    "inputs": [
      {
        "name": "mails",
        "type": "tuple[]",
        "internalType": "struct IHeed.MailIntent[]",
        "components": [
          {
            "name": "recipient",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "valueGwei",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "contentRef",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      },
      {
        "name": "atomic",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "setFee",
    "inputs": [
      {
        "name": "valueGwei",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "trust",
    "inputs": [
      {
        "name": "senders",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "trusts",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "untrust",
    "inputs": [
      {
        "name": "senders",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "DelegateRegistered",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "delegate",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "clientId",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DelegateRevoked",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "delegate",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FeeUpdated",
    "inputs": [
      {
        "name": "recipient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "valueGwei",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "KeyPublished",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "keyNonce",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "pub",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MailSent",
    "inputs": [
      {
        "name": "sender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "recipient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "contentRef",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "valueGwei",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Trusted",
    "inputs": [
      {
        "name": "recipient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "sender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "trusted",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "EmptyPubKey",
    "inputs": []
  },
  {
    "type": "error",
    "name": "FeeAboveCap",
    "inputs": [
      {
        "name": "valueGwei",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "cap",
        "type": "uint32",
        "internalType": "uint32"
      }
    ]
  },
  {
    "type": "error",
    "name": "InsufficientValue",
    "inputs": [
      {
        "name": "sumOfValues",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "msgValue",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidDelegateSignature",
    "inputs": []
  },
  {
    "type": "error",
    "name": "KeyNonceNotMonotonic",
    "inputs": [
      {
        "name": "provided",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "highest",
        "type": "uint32",
        "internalType": "uint32"
      }
    ]
  },
  {
    "type": "error",
    "name": "MailFailed",
    "inputs": [
      {
        "name": "index",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "NotADelegate",
    "inputs": []
  }
] as const;
