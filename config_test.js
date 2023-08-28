
const NODES = [
"https://001-sai-dual.symboltest.net:3001",
"https://201-sai-dual.symboltest.net:3001",
"https://401-sai-dual.symboltest.net:3001",
//"https://pequod.cola-potatochips.net:3001",
"https://vmi831828.contaboserver.net:3001",
"https://marrons-xym-farm001-test.com:3001",
"https://vmi1087624.contaboserver.net:3001",
"https://vmi835907.contaboserver.net:3001",
"https://mikun-testnet.tk:3001",
"https://mikun-testnet2.tk:3001",
"https://reference.symboltest.net:3001",
"https://sym-test-01.opening-line.jp:3001",
"https://sym-test-03.opening-line.jp:3001",
"https://symbol-azure.0009.co:3001",
"https://test01.xymnodes.com:3001",
"https://test02.xymnodes.com:3001",
];


NG_NODE = [
"https://xym.jp2.node.leywapool.com:3001",
"https://0-0-0-0-0-0-0-0-0.king-of-harvesters.com:3001",
"https://0-0-0-highspeed01.surgestar.com:3001",
"https://01.symbol-node.work:3001",
"https://pasomi.dusan.gq:3001",
"https://0-0-0-0-0-0-0-9.tokyo-node.fun:3001",
"https://symbol-tools.com:3001",
"https://xym.jp1.node.leywapool.com:3001",

];

const configSymbolApplication = {
	nodes:NODES,
	selectNodeCount:3,  //同期確認のために接続するノード数
	timeout:8000,  //ノード接続待機時間 ミリ秒
	heightDiffThreshold:  1, // 同期判断ブロック高差
	retryCount:30, //最大再接続回数
	mainnet:"MAIN_NET",
	testnet:"TEST_NET"
};

