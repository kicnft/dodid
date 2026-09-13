(function () {
  "use strict";

  const isHex = (value, length) => new RegExp(`^[0-9a-fA-F]{${length}}$`).test(String(value ?? ""));

  function sign(blockHash, account, core) {
    if (!isHex(blockHash, 64)) throw new Error("ブロックハッシュの形式が正しくありません。");
    return account.keyPair.sign(core.utils.hexToUint8(blockHash)).toString();
  }

  function verify(blockHash, signature, publicKey, core, symbol) {
    if (!isHex(blockHash, 64) || !isHex(signature, 128) || !isHex(publicKey, 64)) return false;
    const verifier = new symbol.Verifier(new core.PublicKey(publicKey));
    return verifier.verify(core.utils.hexToUint8(blockHash), new core.Signature(signature));
  }

  window.SymbolBlockProof = Object.freeze({ sign, verify, isHex });
}());
