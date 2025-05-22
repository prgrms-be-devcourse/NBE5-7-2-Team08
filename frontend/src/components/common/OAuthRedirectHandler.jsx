import { useEffect } from "react";
import axios from "../api/axiosInstance"

const OAuthRedirectHandler = () => {
  useEffect(() => {
    axios.get("/auth", { withCredentials: true })
      .then(() => {
        // 토큰 검사 성공 → 메인 화면으로 이동
        window.location.href = "/";
      })
      .catch(() => {
        window.location.href = "/login";
      });
  }, []);

  return <div>로그인 처리 중입니다...</div>;
};

export default OAuthRedirectHandler;
