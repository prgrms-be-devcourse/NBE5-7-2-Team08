// axiosInstance.jsx

import axios from 'axios';

// ✅ 따로 fallback axios 사용
const rawAxios = axios.create({
  baseURL: 'https://52.78.93.133',
});

const axiosInstance = axios.create({
  baseURL: 'https://52.78.93.133',
  withCredentials: true,
});

axiosInstance.interceptors.request.use(async (config) => {
  if (config.url === '/auth') return config;

  try {
    const authCheck = await rawAxios.get('/auth', {
      withCredentials: true,
    });

    if (authCheck.status === 200) {
      return config;
    }
  } catch (err) {
    console.warn('토큰 검사 실패 → 로그인 페이지로 이동');
    window.location.href = '/login';
    throw new axios.Cancel('인증 실패로 요청 취소됨');
  }
}, (error) => {
  return Promise.reject(error);
});

export default axiosInstance;
