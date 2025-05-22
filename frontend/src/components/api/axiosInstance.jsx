import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'https://52.78.93.133',
  withCredentials: true,
});

axiosInstance.interceptors.request.use(async (config) => {
  if (config.url === '/auth') return config; // /auth 요청 자체는 검사 X

  try {
    const authCheck = await axiosInstance.get('/auth', {
      withCredentials: true,
    });
    if (authCheck.status === 200) {
      return config; // 통과 시 요청 진행
    }
  } catch (err) {
    console.warn('토큰 검사 실패 → 로그인 페이지로 이동');
    window.location.href = '/login';
    throw new axios.Cancel('인증 실패로 요청 취소됨'); // 요청 중단
  }
}, (error) => {
  return Promise.reject(error);
});

export default axiosInstance;
