mod utils;
use base58::{FromBase58, FromBase58Error};
use js_sys::Promise;
use rebase::{
    schema::{
        basic_post::BasicPost as BasicPostSchema,
        schema_type::{SchemaError, SchemaType},
    },
    signer::signer::{SignerType, DID},
    witness::signer_type::SignerTypes,
};
use serde::{Deserialize, Serialize};
use ssi::{one_or_many::OneOrMany, vc::Evidence};
use wasm_bindgen_futures::future_to_promise;

use wasm_bindgen::prelude::*;

macro_rules! jserr {
    ($expression:expr) => {
        match $expression {
            Ok(a) => a,
            Err(e) => {
                return Err(JsValue::from(format!("{}", e)));
            }
        }
    };
}

fn b58_err(err: FromBase58Error) -> String {
    match err {
        FromBase58Error::InvalidBase58Character(_, _) => "invalid base58 character".to_string(),
        FromBase58Error::InvalidBase58Length => "invalid base58 length".to_string(),
    }
}

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[derive(Serialize, Deserialize)]
#[serde(untagged)]
enum Schemas {
    BasicPost(BasicPostSchema),
}

// TODO: Make this a macro!
impl SchemaType for Schemas {
    fn context(&self) -> Result<serde_json::Value, SchemaError> {
        match self {
            Schemas::BasicPost(x) => x.context(),
        }
    }

    fn evidence(&self) -> Result<Option<OneOrMany<Evidence>>, SchemaError> {
        match self {
            Schemas::BasicPost(x) => x.evidence(),
        }
    }

    fn subject(&self) -> Result<serde_json::Value, SchemaError> {
        match self {
            Schemas::BasicPost(x) => x.subject(),
        }
    }

    fn types(&self) -> Result<Vec<String>, SchemaError> {
        match self {
            Schemas::BasicPost(x) => x.types(),
        }
    }
}

#[wasm_bindgen]
pub fn self_issue(stringified_key_type: &str, stringified_schema: &str) -> Promise {
    // So we can move them into the future.
    let key_type = stringified_key_type.to_string();
    let schema = stringified_schema.to_string();

    future_to_promise(async move {
        let did: DID = jserr!(serde_json::from_str(&key_type));
        let schema: Schemas = jserr!(serde_json::from_str(&schema));
        let signer_type = jserr!(SignerTypes::new(&did));
        let c = jserr!(schema.unsigned_credential(&signer_type).await);
        Ok(jserr!(serde_json::to_string(&c)).into())
    })
}

#[inline(always)]
fn url_safe_trailing_bits() -> base64::Config {
    base64::URL_SAFE_NO_PAD.decode_allow_trailing_bits(true)
}

#[wasm_bindgen]
pub fn solana_jwk(solana_addr: &str) -> Result<String, JsValue> {
    match solana_addr.from_base58() {
        Ok(b) => Ok(jserr!(serde_json::to_string(&serde_json::json!({
            "kty": "OKP",
            "crv": "Ed25519",
            "x": base64::encode_config(b, url_safe_trailing_bits())  
        })))),
        Err(e) => Err(JsValue::from_str(&b58_err(e))),
    }

}
