/// 自定义日志写入器，仅对文件输出进行脱敏
/// 控制台输出保持原始内容
use std::io::{self, Write};
use tracing_appender::rolling::RollingFileAppender;
use tracing_subscriber::fmt::writer::MakeWriter;

/// 脱敏文件写入器
pub struct SanitizingFileWriter {
    appender: RollingFileAppender,
}

impl SanitizingFileWriter {
    pub fn new() -> io::Result<Self> {
        let log_dir = crate::directories::get_log_directory();

        // 创建按日期滚动的日志文件
        // 文件名格式: antigravity-agent.2024-01-15.log
        let appender = tracing_appender::rolling::daily(&log_dir, "antigravity-agent");

        Ok(Self { appender })
    }
}

impl Write for SanitizingFileWriter {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        // 将字节转换为字符串进行脱敏处理
        let msg = String::from_utf8_lossy(buf);
        let sanitized = crate::utils::log_sanitizer::sanitize_log_message(&msg);
        self.appender.write_all(sanitized.as_bytes())?;
        Ok(buf.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        self.appender.flush()
    }
}

impl<'a> MakeWriter<'a> for SanitizingFileWriter {
    type Writer = SanitizingFileWriter;

    fn make_writer(&'a self) -> Self::Writer {
        SanitizingFileWriter::new().expect("Failed to create sanitizing file writer")
    }
}
