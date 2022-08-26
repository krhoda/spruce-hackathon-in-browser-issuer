<script type="ts">
    import { BasePage, Button, DownloadIcon, IconLink } from "components";
    import { _signer, alert, getKeyType } from "utils";

    import { self_issue, solana_jwk } from "rebase-issuer";

    import {
        completeIssueCredential,
        prepareIssueCredential,
        verifyCredential,
    } from "@spruceid/didkit-wasm";

    $: title = "";
    $: body = "";
    $: credentials = [];

    export const makeDownloadable = (vc: string): string => {
        let encoded = encodeURIComponent(vc);
        return `data:application/json;charset=utf-8,${encoded}`;
    };

    const doSomething = async () => {
        try {
            console.log(1);
            if (!title || !body) {
                throw new Error("Title and Body must be non-empty strings");
            }

            console.log(2);
            if (!_signer) {
                throw new Error("Signer must be connected");
            }

            console.log(3);
            const did = `did:pkh:solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ:${_signer.id()}`;
            const unsignedCred = await self_issue(
                JSON.stringify(getKeyType()),
                JSON.stringify({
                    title,
                    body,
                    subject_id: did,
                })
            );

            console.log(4);
            console.log(unsignedCred);

            const proofOptions = JSON.stringify({
                verificationMethod: did + "#SolanaMethod2021",
                proofPurpose: "assertionMethod",
            });

            let jwk = solana_jwk(_signer.id());
            console.log(jwk);
            const prep = await prepareIssueCredential(
                unsignedCred,
                proofOptions,
                jwk
            );

            console.log(5);
            const sig = await _signer.sign(unsignedCred);
            const vcStr = await completeIssueCredential(
                unsignedCred,
                prep,
                sig
            );

            const res = JSON.parse(await verifyCredential(vcStr, "{}"));
            if (res.errors.legnth > 0) {
                throw new Error(
                    `Unable to verify credential: ${res.errors.join(", ")}`
                );
            }
            credentials.push(vcStr);
            credentials = credentials;
        } catch (e) {
            console.log("FAILURE");
            console.log(e);

            return alert.set({
                message: e?.message || e,
                variant: "error",
            });
        }
    };
</script>

<BasePage>
    <div class="min-h-[577px] h-full flex flex-wrap">
        <div class="w-full">
            <div
                class="w-full flex flex-wrap justify-center content-between h-full"
            >
                <div class="w-full mx-6 px-4">
                    <label for="title">
                        <p class="font-bold">Title</p>
                        <span>Input Post Title</span>
                    </label>
                    <p>
                        <input
                            class="form-text-input"
                            placeholder="Input Title"
                            bind:value={title}
                            name={`title`}
                            type="text"
                        />
                    </p>
                    <label for="body">
                        <p class="font-bold">Body</p>
                        <span>Input Post Body</span>
                    </label>
                    <p>
                        <input
                            class="form-text-input"
                            placeholder="Input Body"
                            bind:value={body}
                            name={`title`}
                            type="text"
                        />
                    </p>
                    <Button
                        class="w-2/5"
                        onClick={doSomething}
                        text="MAKE IT HAPPEN!"
                        primary
                    />
                    <p>Download Credentials</p>
                    {#if credentials.length <= 0}
                        <p>No Credentials yet.</p>
                    {:else}
                        {#each credentials as credential, i}
                            <div
                                class="obtained-claim-action border border-gray-250 w-8 h-8 rounded-full flex flex-wrap align-center justify-center transition-all"
                            >
                                <p>Download Credential {i}</p>
                                <IconLink
                                    class="block w-4"
                                    icon={DownloadIcon}
                                    href={makeDownloadable(credential)}
                                    download={`credential_${i}.json`}
                                />
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>
        </div>
    </div></BasePage
>
