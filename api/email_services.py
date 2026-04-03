"""
邮箱服务管理 API 路由
"""

from fastapi import APIRouter, HTTPException, Query
from services.cloud_mail import CloudMailService, EmailServiceError, OTP_CODE_PATTERN
from core.config_store import config_store
from typing import Dict, Any, Optional

router = APIRouter(prefix="/email-services", tags=["email-services"])


def _get_cloud_mail_config() -> Dict[str, Any]:
    """从配置存储中获取 Cloud Mail 配置"""
    return {
        "base_url": config_store.get("cloud_mail_base_url", ""),
        "admin_email": config_store.get("cloud_mail_admin_email", ""),
        "admin_password": config_store.get("cloud_mail_admin_password", ""),
        "domain": config_store.get("cloud_mail_domain", ""),
        "subdomain": config_store.get("cloud_mail_subdomain", ""),
        "timeout": int(config_store.get("cloud_mail_timeout", "30")),
    }


@router.post("/cloud-mail/create-email")
async def create_cloud_mail_email(
    name: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    subdomain: Optional[str] = Query(None),
):
    """创建 Cloud Mail 邮箱"""
    try:
        config = _get_cloud_mail_config()
        if not config.get("base_url") or not config.get("admin_password"):
            raise HTTPException(status_code=400, detail="Cloud Mail 配置不完整")
        
        service = CloudMailService(config)
        email_info = service.create_email({"name": name, "domain": domain, "subdomain": subdomain})
        
        return {"success": True, "data": email_info}
    except EmailServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建邮箱失败: {str(e)}")


@router.post("/cloud-mail/get-verification-code")
async def get_cloud_mail_verification_code(
    email: str = Query(...),
    timeout: int = Query(120, ge=10, le=600),
    pattern: Optional[str] = Query(None),
):
    """获取 Cloud Mail 验证码"""
    try:
        config = _get_cloud_mail_config()
        if not config.get("base_url") or not config.get("admin_password"):
            raise HTTPException(status_code=400, detail="Cloud Mail 配置不完整")
        
        service = CloudMailService(config)
        search_pattern = pattern or OTP_CODE_PATTERN
        code = service.get_verification_code(email=email, timeout=timeout, pattern=search_pattern)
        
        if not code:
            raise HTTPException(status_code=408, detail=f"获取验证码超时（{timeout}秒）")
        
        return {"success": True, "code": code, "email": email}
    except EmailServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取验证码失败: {str(e)}")


@router.post("/cloud-mail/health")
async def check_cloud_mail_health():
    """检查 Cloud Mail 服务健康状态"""
    try:
        config = _get_cloud_mail_config()
        if not config.get("base_url"):
            return {"success": True, "healthy": False, "error": "Cloud Mail base_url 未配置"}
        
        service = CloudMailService(config)
        is_healthy = service.check_health()
        
        return {"success": True, "healthy": is_healthy, "service_info": service.get_service_info()}
    except Exception as e:
        return {"success": False, "healthy": False, "error": str(e)}


@router.get("/cloud-mail/config")
async def get_cloud_mail_config_status():
    """获取 Cloud Mail 配置状态"""
    config = _get_cloud_mail_config()
    
    return {
        "success": True,
        "configured": bool(config.get("base_url") and config.get("admin_password")),
        "config": {
            "base_url": config.get("base_url", ""),
            "admin_email": config.get("admin_email", ""),
            "domain": config.get("domain", ""),
            "subdomain": config.get("subdomain", ""),
            "timeout": config.get("timeout", 30),
            "has_password": bool(config.get("admin_password")),
        }
    }


@router.post("/cloud-mail/list-emails")
async def list_cloud_mail_emails():
    """列出已创建的邮箱"""
    try:
        config = _get_cloud_mail_config()
        service = CloudMailService(config)
        emails = service.list_emails()
        
        return {"success": True, "count": len(emails), "emails": emails}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取邮箱列表失败: {str(e)}")


@router.post("/cloud-mail/get-messages")
async def get_cloud_mail_messages(
    email: str = Query(...),
    time_sort: str = Query("desc", regex="^(asc|desc)$"),
):
    """获取邮箱中的邮件列表"""
    try:
        config = _get_cloud_mail_config()
        service = CloudMailService(config)
        messages = service.get_email_messages(email, timeSort=time_sort)
        
        return {"success": True, "email": email, "count": len(messages), "messages": messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取邮件列表失败: {str(e)}")
