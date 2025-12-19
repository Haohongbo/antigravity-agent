use std::env;
use std::path::Path;

fn main() {
    tauri_build::build();

    // 可选的 proto 编译：存在 proto/*.proto 时自动生成 Rust 代码
    compile_protos_if_any();
}

fn compile_protos_if_any() {
    let proto_dir = Path::new("proto");
    if !proto_dir.exists() {
        // 没有 proto 目录，跳过
        return;
    }

    // 确保生成目录存在（放在源码树内，便于 include!）
    let out_dir = Path::new("src").join("proto_gen");
    if let Err(e) = std::fs::create_dir_all(&out_dir) {
        panic!("Failed to create proto_gen dir: {e}");
    }

    let mut protos = Vec::new();
    if let Ok(entries) = std::fs::read_dir(proto_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_some_and(|ext| ext == "proto") {
                protos.push(path);
            }
        }
    }

    if protos.is_empty() {
        return;
    }

    // 监听 proto 目录变化
    println!("cargo:rerun-if-changed=proto");

    // 使用内置 protoc，避免跨平台环境缺 protoc
    let protoc = protoc_bin_vendored::protoc_bin_path()
        .expect("protoc not found (protoc-bin-vendored failed)");
    env::set_var("PROTOC", protoc);

    prost_build::Config::new()
        .out_dir(&out_dir)
        .compile_protos(&protos, &[proto_dir])
        .expect("Failed to compile .proto files");
}
