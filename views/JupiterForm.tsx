import React, { FunctionComponent, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { TokenListProvider, TokenInfo } from "@solana/spl-token-registry";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { useJupiter } from "@jup-ag/react-hook";
import { ENV as ENVChainId } from "@solana/spl-token-registry";
import FeeInfo from "./FeeInfo";

const CHAIN_ID = ENVChainId.MainnetBeta
interface IJupiterFormProps { }
type UseJupiterProps = Parameters<typeof useJupiter>[0];

const JupiterForm: FunctionComponent<IJupiterFormProps> = (props) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [tokenMap, setTokenMap] = useState<Map<string, TokenInfo>>(
    new Map()
  );

  const [formValue, setFormValue] = useState<UseJupiterProps>({
    amount: 1,
    inputMint: undefined,
    outputMint: undefined,
    slippage: 1, // 0.1%
  });

  const [inputTokenInfo, outputTokenInfo] = useMemo(() => {
    return [
      tokenMap.get(formValue.inputMint?.toBase58() || ""),
      tokenMap.get(formValue.outputMint?.toBase58() || ""),
    ];
  }, [formValue.inputMint?.toBase58(), formValue.outputMint?.toBase58()]);

  useEffect(() => {
    new TokenListProvider().resolve().then((tokens) => {
      const tokenList = tokens.filterByChainId(CHAIN_ID).getList();
      console.log(tokenList, "============================")
      setTokenMap(
        tokenList.reduce((map, item) => {
          map.set(item.address, item);
          return map;
        }, new Map())
      );
    });
  }, [setTokenMap]);

  const amountInDecimal = useMemo(() => {
    return formValue.amount * 10 ** (inputTokenInfo?.decimals || 1);
  }, [inputTokenInfo, formValue.amount]);

  const { routeMap, allTokenMints, routes, loading, exchange, error, refresh } = 
    useJupiter({
      ...formValue,
      amount: amountInDecimal,
    });
  const validOutputMints = useMemo(
    () => {
      return routeMap.get(formValue.inputMint?.toBase58() || "") || allTokenMints
    },
    [routeMap, formValue.inputMint?.toBase58()]
  );

  // ensure outputMint can be swapable to inputMint
  useEffect(() => {
    if (formValue.inputMint) {
      const possibleOutputs = routeMap.get(formValue.inputMint.toBase58());

      if (
        possibleOutputs &&
        !possibleOutputs?.includes(formValue.outputMint?.toBase58() || "")
      ) {
        setFormValue((val) => ({
          ...val,
          outputMint: new PublicKey(possibleOutputs[0]),
        }));
      }
    }
  }, [formValue.inputMint?.toBase58(), formValue.outputMint?.toBase58()]);

  return (
    <div>
      <div>
        <div>{wallet.publicKey?.toBase58()}</div>
        <br />
        <h4>Note: Token list is loaded from mainnet and so does Jupiter SDK, <br /> so please use Testnet and proxy to dappio mainnet fork for testing in this site.</h4>
        <br />
        <label htmlFor="inputMint">
          Input token
        </label>
        <select
          id="inputMint"
          name="inputMint"
          value={formValue.inputMint?.toBase58()}
          onChange={(e) => {
            const pbKey = new PublicKey(e.currentTarget.value);
            if (pbKey) {
              setFormValue((val) => ({
                ...val,
                inputMint: pbKey,
              }));
            }
          }}
        >
          {allTokenMints.map((tokenMint) => {
            return (
              <option key={tokenMint} value={tokenMint}>
                {tokenMap.get(tokenMint)?.name || "unknown"}
              </option>
            );
          })}
        </select>
      </div>

      <div>
        <label htmlFor="outputMint">
          Output token
        </label>
        <select
          id="outputMint"
          name="outputMint"
          value={formValue.outputMint?.toBase58()}
          onChange={(e) => {
            const pbKey = new PublicKey(e.currentTarget.value);
            if (pbKey) {
              setFormValue((val) => ({
                ...val,
                outputMint: pbKey,
              }));
            }
          }}
        >
          {validOutputMints.map((tokenMint) => {
            return (
              <option key={tokenMint} value={tokenMint}>
                {tokenMap.get(tokenMint)?.name || "unknown"}
              </option>
            );
          })}
        </select>
      </div>

      <div>
        <label htmlFor="amount">
          Input Amount ({inputTokenInfo?.symbol})
        </label>
        <div>
          <input
            name="amount"
            id="amount"
            value={formValue.amount}
            type="text"
            pattern="[0-9]*"
            onInput={(e: any) => {
              let newValue = Number(e.target?.value || 0);
              newValue = Number.isNaN(newValue) ? 0 : newValue;
              setFormValue((val) => ({
                ...val,
                amount: Math.max(newValue, 0),
              }));
            }}
          />
        </div>
      </div>
      <div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Loading" : 'Refresh rate'}

        </button>
      </div>

      <div>Total routes: {routes?.length}</div>

      {
        routes?.[0] &&
        (() => {
          const route = routes[0];
          return (
            <div>
              <div>
                Best route info :{" "}
                {route.marketInfos.map((info) => info.marketMeta.amm.label)}
              </div>
              <div>
                Output:{" "}
                {route.outAmount / 10 ** (outputTokenInfo?.decimals || 1)}{" "}
                {outputTokenInfo?.symbol}
              </div>
              <FeeInfo route={route} />
            </div>
          );
        })()
      }

      {error && <div>Error in Jupiter, try changing your intpu</div>}

      <div>
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            if (
              !loading &&
              routes?.[0] &&
              wallet.signAllTransactions &&
              wallet.signTransaction &&
              wallet.sendTransaction &&
              wallet.publicKey
            ) {
              const swapResult = await exchange({
                wallet: {
                  sendTransaction: wallet.sendTransaction,
                  publicKey: wallet.publicKey,
                  signAllTransactions: wallet.signAllTransactions,
                  signTransaction: wallet.signTransaction,
                },
                route: routes[0],
                confirmationWaiterFactory: async (txid) => {
                  console.log("sending transaction");
                  await connection.confirmTransaction(txid);
                  console.log("confirmed transaction");

                  return await connection.getTransaction(txid, {
                    commitment: "confirmed",
                  });
                },
              });

              console.log({ swapResult });

              if ("error" in swapResult) {
                console.log("Error:", swapResult.error);
              } else if ("txid" in swapResult) {
                console.log("Sucess:", swapResult.txid);
                console.log("Input:", swapResult.inputAmount);
                console.log("Output:", swapResult.outputAmount);
              }
            }
          }}
        >
          Swap Best Route
        </button>
      </div>
    </div >
  );
};

export default JupiterForm;
