<script lang="ts">
    import {
        _signer,
        claims,
        getKeyType,
        sign,
        signerTypes,
        SignerType,
        currentType,
        connect,
        Claim,
        KeyType,
        alert,
        client,
        titleCase,
    } from "utils";
    import { useNavigate } from "svelte-navigator";
    import {
        DropdownButton,
        WitnessFormHeader,
        WitnessFormStepper,
        Button,
        EthereumIcon,
    } from "components";
    import WitnessFormComplete from "./WitnessFormComplete.svelte";
    import { onMount } from "svelte";
    import { ConnectSignerButton } from "components";
    import Ajv from "ajv";

    const navigate = useNavigate();
    const ajv = new Ajv();
    let statement_schema = null,
        witness_schema = null;

    $: display1 = "";
    $: display2 = "";
    $: statement = "";
    $: signature1 = "";
    $: signature2 = "";
    $: showFirstSign = false;

    let key1: KeyType | false = false;
    let key2: KeyType | false = false;
    let loading: boolean = false;

    let c: Array<Claim> = [];
    claims.subscribe((x) => (c = x));

    const connectNew = async (nextType): Promise<void> => {
        try {
            loading = true;
            currentType.set(nextType as SignerType);
            await connect();
        } catch (e) {
            alert.set({
                message: e?.message ? e.message : e,
                variant: "error",
            });
        }
        loading = false;
    };

    const getKey1 = () => {
        key1 = getKeyType();
        key2 = false;
        if (_signer) {
            display1 = `${_signer.id()}`;
        }
    };

    const getKey2 = async () => {
        key2 = getKeyType();

        if (JSON.stringify(key1) === JSON.stringify(key2)) {
            key2 = false;
            throw new Error(
                "Cannot use same signer for both entries. Please change accounts in the extension then reconnect in the dapp."
            );
        } else if (_signer) {
            display2 = `${_signer.id()}`;
        }
    };

    const getStatement = async (): Promise<void> => {
        if (!key1 || !key2) {
            throw new Error(`Need two keys set to use cross signed credential`);
        }

        let o = {
            opts: {
                self_signed: {
                    key_1: key1,
                    key_2: key2,
                },
            },
        };

        if (!statement_schema) {
            throw new Error("No JSON Schema found for Statement Request");
        }

        if (!ajv.validate(statement_schema, o.opts.self_signed)) {
            throw new Error("Validation of Statement Request failed");
        }

        let b = JSON.stringify(o);
        let res = await client.statement(b);
        let body = JSON.parse(res);

        if (!body.statement) {
            throw new Error("Did not find statement in response.");
        }

        statement = body.statement;
    };

    // TODO: Simplify this pair?
    const signKey2 = async () => {
        if (JSON.stringify(key2) !== JSON.stringify(getKeyType())) {
            throw new Error(`Signer connected is not expected Signer`);
        }

        signature2 = await sign(statement);
    };

    // TODO: Simplify this pair?
    const signKey1 = async () => {
        if (JSON.stringify(key1) !== JSON.stringify(getKeyType())) {
            throw new Error(`Signer connected is not expected Signer`);
        }

        signature1 = await sign(statement);
    };

    const setNew = (credential: string) => {
        let next: Array<Claim> = [];
        for (let i = 0, n = c.length; i < n; i++) {
            let claim = c[i];
            if (claim.credential_type === "self_signed") {
                claim.credentials.push(credential);
            }
            next.push(claim);
        }

        claims.set(next);
    };

    const getCredential = async (): Promise<void> => {
        if (!key1 || !key2 || !signature1 || !signature2) {
            throw new Error(
                "Needs two keys, a statement, and two signatures to create credential"
            );
        }

        const proof = {
            self_signed: {
                statement_opts: {
                    key_1: key1,
                    key_2: key2,
                },
                signature_1: signature1,
                signature_2: signature2,
            },
        };

        if (!witness_schema) {
            throw new Error("No JSON Schema found for Witness Request");
        }

        if (!ajv.validate(witness_schema, proof.self_signed)) {
            throw new Error("Validation of Witness Request failed");
        }

        let b = JSON.stringify({ proof });
        let res = await client.jwt(b);

        let { jwt } = JSON.parse(res);

        setNew(jwt);
    };

    type Workflow = "key1" | "key2" | "sig2" | "sig1" | "complete";
    $: current = "key1";

    const advance = () => {
        switch (current as Workflow) {
            case "key1":
                current = "key2";
                return;
            case "key2":
                current = "sig2";
                return;
            case "sig2":
                current = "sig1";
                return;
            case "sig1":
            case "complete":
                current = "complete";
                return;
        }
    };
    const back = () => {
        switch (current as Workflow) {
            case "key2":
                current = "key1";
                return;
            case "sig2":
                current = "key2";
                return;
            case "sig1":
                current = "sig2";
                return;
            case "complete":
                current = "sig1";
                return;
        }
    };

    onMount(async () => {
        if (_signer) {
            getKey1();
        }

        let instructions_res = JSON.parse(
            await client.instructions(JSON.stringify({ type: "self_signed" }))
        );

        statement_schema = instructions_res.statement_schema;
        witness_schema = instructions_res.witness_schema;
    });
</script>

<WitnessFormHeader
    icon={EthereumIcon}
    title={"Two Key Self Signed Verification Workflow"}
    subtitle={`First signer: ${display1 ? display1 : "none"}`}
    subsubtitle={`Second signer: ${display2 ? display2 : "none"}`}
/>
{#if current === "key1"}
    <WitnessFormStepper
        step={1}
        totalSteps={5}
        label={"Connect First Key"}
        question={"Click the button to connect the first of two signers you would like to link. If the signer is already connected, please continue."}
        labelFor={"form-step-q-1-i-1"}
    >
        <div>
            <div class="px-4 py-3 text-sm text-center">
                <div>Select Signer Type To Connect</div>
            </div>
            <hr />
            {#each signerTypes as t}
                <Button
                    class="w-full py-4"
                    onClick={async () => {
                        await connectNew(t);
                        getKey1();
                        advance();
                    }}
                    text={titleCase(t)}
                    primary
                />
            {/each}
        </div>
    </WitnessFormStepper>
    <div
        class="w-full my-[16px] text-center flex flex-wrap justify-evenly items-center  content-end"
    >
        <Button
            class="w-2/5"
            onClick={() => navigate("/account")}
            text="Back"
            primary
        />
        <Button
            class="w-2/5"
            disabled={current !== "key1" || !key1}
            onClick={() => {
                try {
                    advance();
                } catch (e) {
                    alert.set({
                        variant: "error",
                        message: e?.message ? e.message : e,
                    });
                }
            }}
            text="Next"
            action
        />
    </div>
{/if}
{#if current === "key2"}
    <WitnessFormStepper
        step={2}
        totalSteps={5}
        label={"Connect Second Key"}
        question={"Click the button to connect the second of two signers you would like to link."}
        labelFor={"form-step-q-2-i-1"}
    >
        <div class="px-4 py-3 text-sm text-center">
            <div>Select Second Signer To Connect</div>
            <div>
                NOTE: If using two Signers in the same extension, change the
                active key in the extension, then reconnect on this page.
            </div>
            <hr />
            {#each signerTypes as t}
                <Button
                    class="w-full py-4"
                    onClick={async () => {
                        await connectNew(t);
                        getKey2();
                        await getStatement();
                        advance();
                    }}
                    text={titleCase(t)}
                    primary
                />
            {/each}
        </div>
    </WitnessFormStepper>
    <div
        class="w-full my-[16px] text-center  flex flex-wrap justify-evenly items-center  content-end"
    >
        <Button
            class="w-2/5"
            onClick={back}
            text="Back"
            primary
            disabled={loading}
        />
        <Button
            class="w-2/5"
            disabled={current !== "key2" || !key2 || loading}
            onClick={() => {
                try {
                    advance();
                } catch (e) {
                    alert.set({
                        variant: "error",
                        message: e?.message ? e.message : e,
                    });
                }
            }}
            text="Next"
            action
        />
    </div>
{/if}
{#if current === "sig2"}
    <WitnessFormStepper
        step={3}
        totalSteps={5}
        label={"Sign with the Second Key"}
        question={"Sign the statement with the second signer."}
        labelFor={"form-step-q-3-i-1"}
    >
        <div id="form-step-q-3-i-1">
            <Button
                {loading}
                class="w-2/5 mt-[16px]"
                disabled={current !== "sig2" || signature2 !== ""}
                onClick={async () => {
                    try {
                        loading = true;
                        await signKey2();
                    } catch (e) {
                        alert.set({
                            variant: "error",
                            message: e?.message ? e.message : e,
                        });
                    }
                    loading = false;
                }}
                text="Sign"
                action
            />
        </div>
    </WitnessFormStepper>
    <div
        class="w-full my-[16px] text-center  flex flex-wrap justify-evenly items-center  content-end"
    >
        <Button
            class="w-2/5"
            onClick={back}
            text="Back"
            primary
            disabled={loading}
        />
        <Button
            class="w-2/5"
            disabled={current !== "sig2" || signature2 === "" || loading}
            onClick={() => {
                try {
                    advance();
                } catch (e) {
                    alert.set({
                        variant: "error",
                        message: e?.message ? e.message : e,
                    });
                }
            }}
            text="Next"
            action
        />
    </div>
{/if}
{#if current === "sig1"}
    <WitnessFormStepper
        step={4}
        totalSteps={5}
        label={"Sign with First Key"}
        question={"Sign the statement with the first signer. The signatures will then be used to generate a credential."}
        labelFor={"form-step-q-4-i-1"}
    >
        <div id="form-step-q-4-i-1">
            {#if !showFirstSign}
            <div>
                <div class="px-4 py-3 text-sm text-center">
                    <div>Reconnect First Signer:</div>
                    <div>
                        NOTE: If using two Signers in the same extension, change
                        the active key in the extension, then reconnect on this
                        page.
                    </div>
                </div>
                <hr />
                {#each signerTypes as t}
                    <Button
                        class="w-full py-4"
                        onClick={async () => {
                            await connectNew(t);
                            if (
                                JSON.stringify(key1) ===
                                JSON.stringify(getKeyType())
                            ) {
                                showFirstSign = true;
                            } else {
                                alert.set({
                                    variant: "error",
                                    message:
                                        "Conencted signer did not match signer provided in step one",
                                });
                            }
                        }}
                        text={titleCase(t)}
                        primary
                    />
                {/each}
            </div>
            {:else}
                <Button
                    {loading}
                    class="w-2/5 mt-[16px]"
                    disabled={current !== "sig1" || signature1 !== ""}
                    onClick={async () => {
                        try {
                            loading = true;
                            await signKey1();
                            await getCredential();
                        } catch (e) {
                            alert.set({
                                variant: "error",
                                message: e?.message ? e.message : e,
                            });
                        }
                        loading = false;
                    }}
                    text="Sign"
                    action
                />
            {/if}
        </div>
    </WitnessFormStepper>
    <div
        class="w-full my-[16px] text-center  flex flex-wrap justify-evenly items-center content-end"
    >
        <Button
            class="w-2/5"
            onClick={back}
            text="Back"
            primary
            disabled={loading}
        />
        <Button
            class="w-2/5"
            disabled={current !== "sig1" || signature1 === "" || loading}
            onClick={() => {
                try {
                    advance();
                } catch (e) {
                    alert.set({
                        variant: "error",
                        message: e?.message ? e.message : e,
                    });
                }
            }}
            text="Next"
            action
        />
    </div>
{/if}
{#if current === "complete"}
    <WitnessFormComplete step={5} totalSteps={5} {navigate} />
{/if}
