<script type="ts">
    import { BasePage, Button } from "components";
    import { _signer, alert, getKeyType } from "utils";

    import { self_issue, solana_jwk } from "rebase-issuer";

    import {
        completeIssueCredential,
        prepareIssueCredential,
        verifyCredential,
    } from "@spruceid/didkit-wasm";

    $: title = "";
    $: body = "";

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
            const did = `did:pkh:sol:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ:${_signer.id()}`;
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
                const errorMessage = `Unable to verify credential: ${res.errors.join(
                    ", "
                )}`;
                alert.set({
                    message: errorMessage,
                    variant: "error",
                });
            }

            console.log("SUCCESS");
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
        <p>This is a Test</p>
        <div class="w-full">
            <div
                class="w-full flex flex-wrap justify-center content-between h-full"
            >
                <div class="w-full mx-6 px-4">
                    <label for="title">
                        <p class="font-bold">Title</p>
                        <span>Input Post Title</span>
                    </label>
                    <input
                        class="form-text-input"
                        placeholder="Input Title"
                        bind:value={title}
                        name={`title`}
                        type="text"
                    />
                </div>
                <div class="w-full mx-6 px-4">
                    <label for="body">
                        <p class="font-bold">Body</p>
                        <span>Input Post Body</span>
                    </label>
                    <input
                        class="form-text-input"
                        placeholder="Input Body"
                        bind:value={body}
                        name={`title`}
                        type="text"
                    />
                </div>
                <Button
                    class="w-2/5"
                    onClick={doSomething}
                    text="MAKE IT HAPPEN!"
                    primary
                />
            </div>
        </div>
    </div></BasePage
>
