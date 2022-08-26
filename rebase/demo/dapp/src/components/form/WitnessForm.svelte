<script lang="ts">
    import type { CredentialType, Instructions, Workflow, Claim } from "utils";
    import {
        alert,
        _currentType,
        currentType,
        signerTypes,
        SignerType,
        connect,
        claims,
        getKeyType,
        witnessState,
        sign,
        signer,
        Signer,
        client,
        titleCase,
    } from "utils";
    import { onMount } from "svelte";
    import { useNavigate } from "svelte-navigator";
    import { WitnessFormHeader, Button } from "components";
    import Ajv from "ajv";
    import WitnessFormStatement from "./WitnessFormStatement.svelte";
    import WitnessFormSignature from "./WitnessFormSignature.svelte";
    import WitnessFormWitness from "./WitnessFormWitness.svelte";
    import WitnessFormComplete from "./WitnessFormComplete.svelte";

    const navigate = useNavigate();
    const ajv = new Ajv();
    let statement_schema = null,
        witness_schema = null;

    const dnsPrefix = "rebase_sig=";

    let verified: boolean = false;
    let loading: boolean = false;
    let _signer: Signer | false = false;
    signer.subscribe((x) => (_signer = x));

    const signerChanged = () => {
        if (!_signer) {
            statement = "";
            signature = "";
            delimitor = "";
            handle = "";
            proof = "";
            witnessState.set("statement");
        }
    };

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

    let c: Array<Claim> = [];
    claims.subscribe((x) => (c = x));

    const setNew = (credential: string) => {
        let next: Array<Claim> = [];
        for (let i = 0, n = c.length; i < n; i++) {
            let claim = c[i];
            if (claim.credential_type === type) {
                claim.credentials.push(credential);
            }
            next.push(claim);
        }
        claims.set(next);
    };

    export let type: CredentialType;
    export let instructions: Instructions;

    $: statement = "";
    $: signature = "";
    $: delimitor = "";
    $: handle = "";
    $: proof = "";

    const onChangeValue = (name, value) => {
        switch (name) {
            case "handle":
                handle = value;
                break;
            case "signature":
                signature = value;
                break;
            case "proof":
                proof = value;
                break;
            case "verified":
                verified = value;
                break;
        }
    };

    const post = (): string => {
        switch (type) {
            case "discord":
            case "github":
            case "twitter":
                return `${statement}${delimitor}${signature}`;
            case "dns":
                return `${dnsPrefix}${signature}`;
            case "soundcloud":
            case "reddit":
                return `${signature}`;
        }
    };

    let state: Workflow = "statement";
    witnessState.subscribe((x) => (state = x));

    onMount(async () => {
        let res = await client.instructions(JSON.stringify({ type }));
        let instruction_res = JSON.parse(res);
        statement_schema = instruction_res?.statement_schema;
        witness_schema = instruction_res?.witness_schema;
        witnessState.set("statement");
    });

    const advance = () => {
        switch (state) {
            case "statement":
                return witnessState.set("signature");
            case "signature":
                return witnessState.set("witness");
            case "witness":
                return witnessState.set("complete");
            case "complete":
                return;
        }
    };

    const back = () => {
        switch (state) {
            case "signature":
                return witnessState.set("statement");
            case "witness":
                return witnessState.set("signature");
            case "complete":
                return witnessState.set("witness");
        }
    };

    const getStatement = async (): Promise<void> => {
        let opts = {};
        opts[type] = {};

        switch (type) {
            case "dns":
                opts[type]["domain"] = handle;
                opts[type]["prefix"] = dnsPrefix;
                opts[type]["key_type"] = getKeyType();
                break;
            case "github":
            case "twitter":
            case "reddit":
                opts[type]["handle"] = handle;
                opts[type]["key_type"] = getKeyType();
                break;
            case "soundcloud":
                opts[type]["permalink"] = handle.split("/")[handle.split("/").length - 1];
                opts[type]["key_type"] = getKeyType();
                break;
            default:
                throw new Error(`${type} flow is currently unsupported`);
        }


        if (!statement_schema) {
            throw new Error("No JSON Schema found for Statement Request");
        }

        if (!ajv.validate(statement_schema, opts[type])) {
            throw new Error("Validation of Statement Request failed");
        }

        let res = await client.statement(JSON.stringify({ opts }));

        let body = JSON.parse(res);
        if (!body.statement || !body.delimitor) {
            throw new Error(
                "Did not find statement and delimitor in response."
            );
        }

        statement = body.statement;
        delimitor = body.delimitor;
    };

    const getCredential = async (): Promise<void> => {
        let opts = {};

        switch (type) {
            case "dns":
                opts["dns"] = {};
                opts["dns"]["domain"] = handle;
                opts["dns"]["prefix"] = dnsPrefix;
                opts["dns"]["key_type"] = getKeyType();
                break;
            case "reddit": 
                opts["reddit"] = {};
                opts["reddit"]["handle"] = handle;
                opts["reddit"]["key_type"] = getKeyType();
                break;
            case "soundcloud":
                opts["soundcloud"] = {};
                opts["soundcloud"]["permalink"] = handle.split("/")[handle.split("/").length - 1];
                opts["soundcloud"]["key_type"] = getKeyType();
                break;
            case "github":
                opts["github"] = {};
                opts["github"]["statement_opts"] = {};
                opts["github"]["statement_opts"]["handle"] = handle;
                opts["github"]["statement_opts"]["key_type"] = getKeyType();
                opts["github"]["gist_id"] = proof.split("/").pop();
                break;
            case "twitter":
                opts["twitter"] = {};
                opts["twitter"]["statement_opts"] = {};
                opts["twitter"]["statement_opts"]["handle"] = handle;
                opts["twitter"]["statement_opts"]["key_type"] = getKeyType();
                opts["twitter"]["tweet_url"] = proof.split("?")[0];
                break;
            default:
                throw new Error(`${type} flow is currently unsupported`);
        }

        if (!witness_schema) {
            throw new Error("No JSON Schema found for Witness Request");
        }

        if (!ajv.validate(witness_schema, opts[type])) {
            throw new Error("Validation of Witness Request failed");
        }

        let b = JSON.stringify({ proof: opts });
        let res = await client.jwt(b);

        let { jwt } = JSON.parse(res);
        setNew(jwt);
    };
</script>

<WitnessFormHeader
    icon={instructions.icon}
    title={instructions.title}
    subtitle={instructions.subtitle}
/>
{#if _signer}
    {#if state === "statement"}
        <WitnessFormStatement
            {instructions}
            {loading}
            {handle}
            {onChangeValue}
            {navigate}
            {getStatement}
            {advance}
        />
    {/if}
    {#if state === "signature"}
        <WitnessFormSignature
            {instructions}
            {loading}
            {statement}
            {signature}
            {onChangeValue}
            {sign}
            {back}
            {advance}
        />
    {/if}
    {#if state === "witness"}
        <WitnessFormWitness
            {instructions}
            {loading}
            {verified}
            {type}
            {proof}
            {onChangeValue}
            {getCredential}
            {post}
            {back}
            {advance}
        />
    {/if}
    {#if state === "complete"}
        <WitnessFormComplete {navigate} />
    {/if}
{:else}
        <!-- class="w-full my-[16px] text-center  flex flex-wrap justify-evenly items-center  content-end" -->
    <div
        class="w-full"
    >
        <div class="px-4 py-3 text-sm text-center">
            <div>Select Signer Type To Connect</div>
        </div>
        <hr />
        {#each signerTypes as t}
            <Button
                class="w-full py-4"
                onClick={async () => {
                    await connectNew(t);
                }}
                text={titleCase(t)}
                primary
            />
        {/each}
    </div>
{/if}
