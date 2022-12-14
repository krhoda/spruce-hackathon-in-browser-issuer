<script lang="ts">
    import {
        _currentType,
        currentType,
        connect,
        disconnect,
        signerTypes,
        signer,
        Signer,
        SignerType,
        alert,
    } from "utils";
    import { Tooltip, Button, DropdownButton, RebaseLogo } from "components";
    import { scale } from "svelte/transition";
    import { Link, useNavigate } from "svelte-navigator";

    const navigate = useNavigate();
    let moreDropdown;
    let loading: boolean = false;

    let _signer: Signer | false = false;
    signer.subscribe((x) => (_signer = x));

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

    const capitalizeFirstLetter = (string) => {
        return string.charAt(0).toUpperCase() + string.slice(1);
    };
</script>

<div
    class="min-w-screen px-4 h-[70px] w-full flex items-center justify-between bg-white shadow"
>
    <Link to="/account">
        <RebaseLogo class="w-fit flex items-center" xl />
    </Link>
    {#if !_signer}
        <DropdownButton
            class="menu w-full min-w-42 my-[16px] rounded-xl"
            text="Connect Wallet"
            primary
            {loading}
        >
            <div
                in:scale={{ duration: 100, start: 0.95 }}
                out:scale={{ duration: 75, start: 0.95 }}
                class="origin-top-right absolute right-4 w-48 py-0 mt-1 bg-dark-1 rounded-xl shadow-md"
            >
                <div class="px-4 py-3 text-sm text-white text-center">
                    <div>Select Signer Type To Connect</div>
                </div>
                <hr />
                {#each signerTypes as t}
                    <Button
                        class="w-full bg-dark-1 text-white py-4"
                        onClick={() => connectNew(t)}
                        text={capitalizeFirstLetter(t)}
                    />
                {/each}
            </div>
        </DropdownButton>
    {:else}
        <div class="flex flex-wrap">
            <Tooltip tooltip="Currently using {_currentType} signer" bottom>
                <Button
                    class="max-w-42 sm:max-w-full my-[16px]"
                    onClick={() => navigate("/account")}
                    text={_signer?.ens?.name ?? _signer.id()}
                    primary
                    avatar={_signer?.ens?.avatar ?? false}
                />
            </Tooltip>
            <DropdownButton
                bind:this={moreDropdown}
                class="w-[65px] my-[16px] rounded-xl"
                ml
                text="&#8226;&#8226;&#8226;"
                primary
            >
                <div
                    in:scale={{ duration: 100, start: 0.95 }}
                    out:scale={{ duration: 75, start: 0.95 }}
                    class="origin-top-right absolute right-4 w-48 py-0 mt-1 bg-dark-1 rounded-xl shadow-md"
                >
                    <Button
                        class="w-full bg-dark-1 text-white py-4"
                        onClick={() => {
                            navigate("/");
                            moreDropdown.closeDropdown();
                        }}
                        text="About"
                    />
                    <Button
                        class="w-full bg-dark-1 text-white py-4"
                        onClick={() => {
                            disconnect();
                            moreDropdown.closeDropdown();
                        }}
                        text="Disconnect"
                    />
                </div>
            </DropdownButton>
        </div>
    {/if}
</div>
