"""
注册流程引擎 V2
使用完全独立的基于 curl_cffi 和 OAuth redirect 流程，完美绕过 add_phone 问题。
重用 chatgpt_register_v2_by_AI 中的逻辑。
"""

import sys
import os
import time
import logging
from datetime import datetime
from typing import Optional, Callable

from core.base_platform import AccountStatus
from platforms.chatgpt.register import RegistrationResult

# 将 chatgpt_register_v2_by_AI 目录加入 Python 路径，方便导入
V2_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "chatgpt_register_v2_by_AI")
if V2_PATH not in sys.path:
    sys.path.append(V2_PATH)

from .chatgpt_client import ChatGPTClient
from .oauth_client import OAuthClient
from .utils import generate_random_name, generate_random_birthday

logger = logging.getLogger(__name__)

class EmailServiceAdapter:
    """包装 V1 的 email_service 使其符合 V2 Client 需要的接口"""
    def __init__(self, email_service, email, log_fn):
        self.es = email_service
        self.email = email
        self.log_fn = log_fn

    def wait_for_verification_code(self, email, timeout=60, otp_sent_at=None):
        # 原版 email_service 提供 get_verification_code(timeout=...)
        msg = f"正在等待邮箱 {email} 的验证码 ({timeout}s)..."
        self.log_fn(msg)
        code = self.es.get_verification_code(timeout=timeout, otp_sent_at=otp_sent_at)
        if code:
            self.log_fn(f"成功获取验证码: {code}")
        return code

class RegistrationEngineV2:
    def __init__(
        self,
        email_service,
        proxy_url: Optional[str] = None,
        callback_logger: Optional[Callable[[str], None]] = None,
        task_uuid: Optional[str] = None
    ):
        self.email_service = email_service
        self.proxy_url = proxy_url
        self.callback_logger = callback_logger
        self.task_uuid = task_uuid
        
        self.email = None
        self.password = None
        self.logs = []
        
    def _log(self, message: str, level: str = "info"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_message = f"[{timestamp}] {message}"
        self.logs.append(log_message)
        if self.callback_logger:
            self.callback_logger(log_message)
        if level == "error":
            logger.error(log_message)
        else:
            logger.info(log_message)

    def run(self) -> RegistrationResult:
        result = RegistrationResult(success=False, logs=self.logs)
        try:
            self._log("=" * 60)
            self._log("开始注册流程 V2 (OAuth Curl_cffi绕过风控)")
            self._log("=" * 60)

            # 1. 创建邮箱
            email_data = self.email_service.create_email()
            email_addr = self.email or (email_data.get('email') if email_data else None)
            if not email_addr:
                result.error_message = "创建邮箱失败"
                return result
                
            result.email = email_addr
            
            pwd = self.password or "AAb1234567890!"
            result.password = pwd
            
            # 随机姓名、生日
            first_name, last_name = generate_random_name()
            birthdate = generate_random_birthday()
            
            self._log(f"邮箱: {email_addr}, 密码: {pwd}")
            self._log(f"注册信息: {first_name} {last_name}, 生日: {birthdate}")
            
            # 使用包装器为底层客户端提供接码服务
            skymail_adapter = EmailServiceAdapter(self.email_service, email_addr, self._log)
            
            # 2. 初始化 V2 客户端
            chatgpt_client = ChatGPTClient(proxy=self.proxy_url, verbose=False)
            # 注入日志方法
            chatgpt_client._log = self._log
            
            self._log("开始执行完整注册认证流(OAuth Redirect)...")
            
            success, msg = chatgpt_client.register_complete_flow(
                email_addr, pwd, first_name, last_name, birthdate, skymail_adapter
            )
            
            if not success:
                result.error_message = f"注册流失败: {msg}"
                return result
                
            self._log("新账号已创建，注册流完成，开始无缝获取 OAuth AccessToken...")
            # 3. 初始化 OAuth V2 客户端
            oauth_client = OAuthClient(config={}, proxy=self.proxy_url, verbose=False)
            oauth_client._log = self._log
            # **核心黑科技**: 复用同一批 Cookies 免受各种二次风控验证
            oauth_client.session = chatgpt_client.session  
            
            tokens = oauth_client.login_and_get_tokens(
                email_addr, pwd,
                chatgpt_client.device_id,
                chatgpt_client.ua,
                chatgpt_client.sec_ch_ua,
                chatgpt_client.impersonate,
                skymail_adapter
            )
            
            if tokens and tokens.get("access_token"):
                self._log("Token 换取完成！")
                result.success = True
                result.access_token = tokens.get("access_token")
                result.refresh_token = tokens.get("refresh_token")
                result.id_token = tokens.get("id_token")
                result.account_id = "v2_acct_" + chatgpt_client.device_id[:8]
                
                # 从认证后的 Cookie 结构体里直接解析 Workspace
                session_data = oauth_client._decode_oauth_session_cookie()
                if session_data:
                    workspaces = session_data.get("workspaces", [])
                    if workspaces:
                        result.workspace_id = str((workspaces[0] or {}).get("id") or "")
                        self._log(f"成功萃取 Workspace ID: {result.workspace_id}")
                    else:
                        self._log("oai-client-auth-session 中仍无 workspace信息，但这通常是正常情况，重试即可", "warning")
                        
                session_cookie = None
                for cookie in oauth_client.session.cookies.jar:
                    if cookie.name == "__Secure-next-auth.session-token":
                        session_cookie = cookie.value
                        break
                result.session_token = session_cookie
                
                self._log("=" * 60)
                self._log("注册流程成功结束!")
                self._log("=" * 60)
                return result
            else:
                result.error_message = "成功创建了账号但获取最终 OAuth Tokens 失败"
                return result
                
        except Exception as e:
            self._log(f"V2 注册全流程执行异常: {e}", "error")
            import traceback
            traceback.print_exc()
            result.error_message = str(e)
            return result
