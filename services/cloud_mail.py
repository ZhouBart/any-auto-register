"""
Cloud Mail 邮箱服务实现
基于 Cloudflare Workers 的邮箱服务 (https://doc.skymail.ink)
"""

import re
import time
import logging
import random
import string
import requests
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

OTP_CODE_PATTERN = r"(?<!\d)(\d{6})(?!\d)"


class EmailServiceError(Exception):
    """邮箱服务异常"""
    pass


class CloudMailService:
    """
    Cloud Mail 邮箱服务
    基于 Cloudflare Workers 的自部署邮箱服务
    """
    
    # 类变量：所有实例共享token（按base_url区分）
    _shared_tokens: Dict[str, tuple] = {}
    _token_lock = None
    _seen_ids_lock = None
    _shared_seen_email_ids: Dict[str, set] = {}

    def __init__(self, config: Dict[str, Any] = None, name: str = None):
        """
        初始化 Cloud Mail 服务

        Args:
            config: 配置字典，支持以下键:
                - base_url: API 基础地址 (必需)
                - admin_email: 管理员邮箱 (可选)
                - admin_password: 管理员密码 (必需)
                - domain: 邮箱域名 (可选)
                - subdomain: 子域名 (可选)
                - timeout: 请求超时时间，默认 30
        """
        required_keys = ["base_url", "admin_password"]
        missing_keys = [key for key in required_keys if not (config or {}).get(key)]
        if missing_keys:
            raise ValueError(f"缺少必需配置: {missing_keys}")

        default_config = {
            "timeout": 30,
            "max_retries": 3,
            "proxy_url": None,
        }
        self.config = {**default_config, **(config or {})}
        self.config["base_url"] = self.config["base_url"].rstrip("/")
        
        if not self.config.get("admin_email"):
            domain = self._extract_domain_from_url(self.config["base_url"])
            self.config["admin_email"] = f"admin@{domain}"

        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "Content-Type": "application/json",
        })
        
        if CloudMailService._token_lock is None:
            import threading
            CloudMailService._token_lock = threading.Lock()
            CloudMailService._seen_ids_lock = threading.Lock()

        self._created_emails: Dict[str, Dict[str, Any]] = {}
        self.name = name or "cloud_mail_service"

    def _extract_domain_from_url(self, url: str) -> str:
        """从 URL 中提取域名"""
        from urllib.parse import urlparse
        parsed = urlparse(url)
        domain = parsed.netloc or parsed.path.split('/')[0]
        if not domain:
            raise ValueError(f"无法从 URL 提取域名: {url}")
        return domain

    def _generate_token(self) -> str:
        """生成身份令牌"""
        url = f"{self.config['base_url']}/api/public/genToken"
        payload = {
            "email": self.config["admin_email"],
            "password": self.config["admin_password"]
        }

        try:
            response = self.session.post(url, json=payload, timeout=self.config["timeout"])

            if response.status_code >= 400:
                error_msg = f"生成 token 失败: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg = f"{error_msg} - {error_data}"
                except:
                    error_msg = f"{error_msg} - {response.text[:200]}"
                raise EmailServiceError(error_msg)

            data = response.json()
            if data.get("code") != 200:
                raise EmailServiceError(f"生成 token 失败: {data.get('message', 'Unknown error')}")

            token = data.get("data", {}).get("token")
            if not token:
                raise EmailServiceError("生成 token 失败: 未返回 token")

            return token

        except requests.RequestException as e:
            raise EmailServiceError(f"生成 token 失败: {e}")

    def _get_token(self, force_refresh: bool = False) -> str:
        """获取有效的 token（带缓存，所有实例共享）"""
        base_url = self.config["base_url"]
        
        with CloudMailService._token_lock:
            if not force_refresh and base_url in CloudMailService._shared_tokens:
                token, expires_at = CloudMailService._shared_tokens[base_url]
                if time.time() < expires_at:
                    return token

            token = self._generate_token()
            expires_at = time.time() + 3600  # 1 小时后过期
            CloudMailService._shared_tokens[base_url] = (token, expires_at)
            return token

    def _get_headers(self, token: Optional[str] = None) -> Dict[str, str]:
        """构造请求头"""
        if token is None:
            token = self._get_token()

        return {
            "Authorization": token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _make_request(self, method: str, path: str, retry_on_auth_error: bool = True, **kwargs) -> Any:
        """发送请求并返回 JSON 数据"""
        url = f"{self.config['base_url']}{path}"
        kwargs.setdefault("headers", {})
        kwargs["headers"].update(self._get_headers())
        kwargs.setdefault("timeout", self.config["timeout"])

        try:
            response = self.session.request(method, url, **kwargs)

            if response.status_code >= 400:
                if response.status_code == 401 and retry_on_auth_error:
                    logger.warning("Cloud Mail 认证失败，尝试刷新 token")
                    kwargs["headers"].update(self._get_headers(self._get_token(force_refresh=True)))
                    response = self.session.request(method, url, **kwargs)

                if response.status_code >= 400:
                    error_msg = f"请求失败: {response.status_code}"
                    try:
                        error_data = response.json()
                        error_msg = f"{error_msg} - {error_data}"
                    except:
                        error_msg = f"{error_msg} - {response.text[:200]}"
                    raise EmailServiceError(error_msg)

            try:
                return response.json()
            except:
                return {"raw_response": response.text}

        except requests.RequestException as e:
            raise EmailServiceError(f"请求失败: {method} {path} - {e}")

    def _generate_email_address(self, prefix: Optional[str] = None, domain: Optional[str] = None, subdomain: Optional[str] = None) -> str:
        """生成邮箱地址"""
        if not prefix:
            first = random.choice(string.ascii_lowercase)
            rest = "".join(random.choices(string.ascii_lowercase + string.digits, k=9))
            prefix = f"{first}{rest}"

        if not domain:
            domain_config = self.config.get("domain")
            if not domain_config:
                base_url = self.config.get("base_url")
                if base_url:
                    domain = self._extract_domain_from_url(base_url)
                else:
                    raise EmailServiceError("未配置邮箱域名，且无法从 API 地址提取域名")
            else:
                if isinstance(domain_config, list):
                    if not domain_config:
                        raise EmailServiceError("域名列表为空")
                    domain = random.choice(domain_config)
                else:
                    domain = domain_config

        if subdomain:
            domain = f"{subdomain}.{domain}"

        return f"{prefix}@{domain}"

    def create_email(self, config: Dict[str, Any] = None) -> Dict[str, Any]:
        """创建新邮箱地址"""
        req_config = config or {}

        prefix = req_config.get("name")
        specified_domain = req_config.get("domain")
        subdomain = req_config.get("subdomain") or self.config.get("subdomain")
        
        if specified_domain:
            email_address = self._generate_email_address(prefix, specified_domain, subdomain)
        else:
            email_address = self._generate_email_address(prefix, subdomain=subdomain)

        email_info = {
            "email": email_address,
            "service_id": email_address,
            "id": email_address,
            "created_at": time.time(),
        }

        self._created_emails[email_address] = email_info
        logger.info(f"生成 CloudMail 邮箱: {email_address}")
        return email_info

    def get_verification_code(
        self, email: str, email_id: str = None, timeout: int = 120,
        pattern: str = OTP_CODE_PATTERN, otp_sent_at: Optional[float] = None,
    ) -> Optional[str]:
        """从 Cloud Mail 邮箱获取验证码"""
        start_time = time.time()
        
        initial_seen_ids = set()
        with CloudMailService._seen_ids_lock:
            if email not in CloudMailService._shared_seen_email_ids:
                CloudMailService._shared_seen_email_ids[email] = set()
            else:
                initial_seen_ids = CloudMailService._shared_seen_email_ids[email].copy()
        
        current_seen_ids = set()

        while time.time() - start_time < timeout:
            try:
                url_path = "/api/public/emailList"
                payload = {"toEmail": email, "timeSort": "desc"}

                result = self._make_request("POST", url_path, json=payload)

                if result.get("code") != 200:
                    time.sleep(3)
                    continue

                emails = result.get("data", [])
                if not isinstance(emails, list):
                    time.sleep(3)
                    continue

                for email_item in emails:
                    email_id_item = email_item.get("emailId")
                    
                    if not email_id_item or email_id_item in initial_seen_ids or email_id_item in current_seen_ids:
                        continue
                    
                    current_seen_ids.add(email_id_item)
                    
                    with CloudMailService._seen_ids_lock:
                        CloudMailService._shared_seen_email_ids[email].add(email_id_item)
                    
                    sender_email = str(email_item.get("sendEmail", "")).lower()
                    sender_name = str(email_item.get("sendName", "")).lower()
                    subject = str(email_item.get("subject", ""))
                    to_email = email_item.get("toEmail", "")
                    
                    if to_email != email or ("openai" not in sender_email and "openai" not in sender_name):
                        continue

                    match = re.search(pattern, subject)
                    if match:
                        return match.group(1)

                    content = str(email_item.get("content", ""))
                    if content:
                        clean_content = re.sub(r"<[^>]+>", " ", content)
                        email_pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
                        clean_content = re.sub(email_pattern, "", clean_content)
                        match = re.search(pattern, clean_content)
                        if match:
                            return match.group(1)

            except Exception as e:
                if "401" in str(e) or "认证" in str(e):
                    try:
                        self._get_token(force_refresh=True)
                    except:
                        pass
                logger.error(f"检查邮件时出错: {e}", exc_info=True)

            time.sleep(3)

        logger.warning(f"等待验证码超时: {email}")
        return None

    def list_emails(self, **kwargs) -> List[Dict[str, Any]]:
        """列出已创建的邮箱"""
        return list(self._created_emails.values())

    def delete_email(self, email_id: str) -> bool:
        """删除邮箱"""
        if email_id in self._created_emails:
            del self._created_emails[email_id]
            return True
        return False

    def check_health(self) -> bool:
        """检查服务健康状态"""
        try:
            self._get_token(force_refresh=True)
            return True
        except Exception as e:
            logger.warning(f"Cloud Mail 健康检查失败: {e}")
            return False

    def get_email_messages(self, email_id: str, **kwargs) -> List[Dict[str, Any]]:
        """获取邮箱中的邮件列表"""
        try:
            url_path = "/api/public/emailList"
            payload = {"toEmail": email_id, "timeSort": kwargs.get("timeSort", "desc")}

            result = self._make_request("POST", url_path, json=payload)

            if result.get("code") != 200:
                logger.warning(f"获取邮件列表失败: {result.get('message')}")
                return []

            return result.get("data", [])

        except Exception as e:
            logger.error(f"获取 Cloud Mail 邮件列表失败: {email_id} - {e}")
            return []

    def get_service_info(self) -> Dict[str, Any]:
        """获取服务信息"""
        return {
            "service_type": "cloud_mail",
            "name": self.name,
            "base_url": self.config["base_url"],
            "admin_email": self.config["admin_email"],
            "domain": self.config.get("domain"),
            "subdomain": self.config.get("subdomain"),
            "cached_emails_count": len(self._created_emails),
        }
