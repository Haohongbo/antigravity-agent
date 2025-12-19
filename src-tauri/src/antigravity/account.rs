use base64::Engine;
use prost::Message;
use serde_json::Value;

/// 将 jetskiStateSync.agentManagerInitState 作为 SessionResponse proto 解码
pub fn decode_jetski_state_proto(b64: &str) -> Result<Value, String> {
    if b64.trim().is_empty() {
        return Err("jetskiStateSync.agentManagerInitState 为空".to_string());
    }

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| {
            format!(
                "jetskiStateSync.agentManagerInitState Base64 解码失败(len={}): {}",
                b64.len(),
                e
            )
        })?;

    let msg = crate::proto::SessionResponse::decode(bytes.as_slice()).map_err(|e| {
        format!(
            "jetskiStateSync.agentManagerInitState Protobuf 解码失败(len={}): {}",
            bytes.len(),
            e
        )
    })?;

    Ok(session_response_to_json(&msg))
}

fn session_response_to_json(msg: &crate::proto::SessionResponse) -> Value {
    use crate::proto::*;

    let b64 = |data: &Vec<u8>| {
        if data.is_empty() {
            None
        } else {
            Some(base64::engine::general_purpose::STANDARD.encode(data))
        }
    };

    let history = msg.history.as_ref().map(|h| {
        Value::Array(
            h.items
                .iter()
                .map(|entry| {
                    serde_json::json!({
                        "session_id": entry.session_id,
                        "detail_raw_base64": b64(&entry.detail_raw),
                    })
                })
                .collect(),
        )
    });

    let auth = msg.auth.as_ref().map(|a| {
        serde_json::json!({
            "access_token": a.access_token,
            "type": a.r#type,
            "id_token": a.id_token,
            "meta": a.meta.as_ref().map(|m| serde_json::json!({
                "expiry_timestamp": m.expiry_timestamp
            }))
        })
    });

    let model_item = |item: &ModelItem| {
        serde_json::json!({
            "name": item.name,
            "unknown_f2_base64": b64(&item.unknown_f2),
            "unknown_f5": item.unknown_f5,
            "unknown_f11": item.unknown_f11,
            "unknown_f15_base64": b64(&item.unknown_f15),
        })
    };

    let models = msg
        .context
        .as_ref()
        .and_then(|ctx| ctx.models.as_ref())
        .map(|m| {
            serde_json::json!({
                "items": m.items.iter().map(model_item).collect::<Vec<_>>(),
                "recommended": m.recommended.as_ref().map(|r| serde_json::json!({
                    "names": r.names,
                    "unknown_f2_base64": b64(&r.unknown_f2),
                })),
                "unknown_f3_base64": b64(&m.unknown_f3),
            })
        });

    let plan = msg
        .context
        .as_ref()
        .and_then(|ctx| ctx.plan.as_ref())
        .map(|p| {
            serde_json::json!({
                "slug": p.slug,
                "name": p.name,
                "description": p.description,
                "upgrade_url": p.upgrade_url,
                "upgrade_msg": p.upgrade_msg,
            })
        });

    let context = msg.context.as_ref().map(|ctx| {
        serde_json::json!({
            "status": ctx.status,
            "plan_name": ctx.plan_name,
            "email": ctx.email,
            "models": models,
            "plan": plan,
        })
    });

    serde_json::json!({
        "history": history,
        "flags_f5_base64": b64(&msg.flags_f5),
        "auth": auth,
        "f7_base64": b64(&msg.f7),
        "f9_base64": b64(&msg.f9),
        "f11_base64": b64(&msg.f11),
        "user_id_raw_base64": b64(&msg.user_id_raw),
        "f18_base64": b64(&msg.f18),
        "context": context,
    })
}
