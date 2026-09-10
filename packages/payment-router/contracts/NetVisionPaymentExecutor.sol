// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Net Vision payment executor — NOT DEPLOYED.
 *
 * Dumb conversion helper: server-authorized swap to canonical USDG,
 * optional conversion-service fee, remainder to the user. Never custodial.
 * Never a general-purpose router. Frontend cannot invent router/calldata/fee.
 */
contract NetVisionPaymentExecutor {
    error WrongChain();
    error Expired();
    error QuoteUsed();
    error BadSigner();
    error RouterNotAllowed();
    error TokenNotAllowed();
    error FeeTooHigh();
    error MinOut();
    error NotUser();
    error BadOutput();

    uint256 public constant ROBINHOOD_CHAIN_ID = 4663;

    address public immutable usdg;
    address public immutable feeRecipient;
    address public immutable authorizer;

    mapping(bytes32 => bool) public usedQuotes;
    mapping(address => bool) public allowedRouters;
    mapping(address => bool) public allowedInputTokens;

    bytes32 public constant AUTH_TYPEHASH =
        keccak256(
            "PaymentAuthorization(bytes32 quoteId,address user,address inputToken,address router,uint256 maxInput,uint256 minUsdgOut,uint256 listingUsdg,uint256 feeUsdg,uint256 expiresAt,uint256 nonce)"
        );

    constructor(address usdg_, address feeRecipient_, address authorizer_) {
        usdg = usdg_;
        feeRecipient = feeRecipient_;
        authorizer = authorizer_;
    }

    function setRouter(address router, bool allowed) external {
        if (msg.sender != authorizer) revert BadSigner();
        allowedRouters[router] = allowed;
    }

    function setInputToken(address token, bool allowed) external {
        if (msg.sender != authorizer) revert BadSigner();
        allowedInputTokens[token] = allowed;
    }

    function executePayment(
        bytes32 quoteId,
        address inputToken,
        uint256 maxInput,
        address router,
        bytes calldata approvedSwapData,
        uint256 minUsdgOut,
        uint256 listingUsdg,
        uint256 feeUsdg,
        address user,
        uint256 expiresAt,
        uint256 nonce,
        bytes calldata signature
    ) external payable {
        if (block.chainid != ROBINHOOD_CHAIN_ID) revert WrongChain();
        if (msg.sender != user) revert NotUser();
        if (block.timestamp > expiresAt) revert Expired();
        if (usedQuotes[quoteId]) revert QuoteUsed();
        if (!allowedRouters[router]) revert RouterNotAllowed();
        if (inputToken != address(0) && !allowedInputTokens[inputToken]) revert TokenNotAllowed();
        if (feeUsdg > minUsdgOut) revert FeeTooHigh();

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(
                    abi.encode(
                        AUTH_TYPEHASH,
                        quoteId,
                        user,
                        inputToken,
                        router,
                        maxInput,
                        minUsdgOut,
                        listingUsdg,
                        feeUsdg,
                        expiresAt,
                        nonce
                    )
                )
            )
        );
        if (_recover(digest, signature) != authorizer) revert BadSigner();

        usedQuotes[quoteId] = true;

        uint256 usdgBefore = _balance(usdg, address(this));
        (bool ok, ) = router.call{value: msg.value}(approvedSwapData);
        require(ok, "swap failed");
        uint256 produced = _balance(usdg, address(this)) - usdgBefore;
        if (produced < minUsdgOut) revert MinOut();
        if (feeUsdg > produced) revert FeeTooHigh();

        if (feeUsdg > 0) {
            _transfer(usdg, feeRecipient, feeUsdg);
        }
        uint256 remainder = produced - feeUsdg;
        if (remainder > 0) {
            _transfer(usdg, user, remainder);
        }

        if (_balance(usdg, address(this)) != 0) revert BadOutput();
    }

    function _recover(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "sig");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        return ecrecover(digest, v, r, s);
    }

    function _balance(address token, address who) internal view returns (uint256) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSelector(0x70a08231, who));
        require(ok && data.length >= 32, "balance");
        return abi.decode(data, (uint256));
    }

    function _transfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transfer");
    }
}
