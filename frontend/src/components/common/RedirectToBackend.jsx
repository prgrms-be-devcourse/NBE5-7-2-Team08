// RedirectToBackend.jsx
import { useEffect } from 'react';

const RedirectToBackend = () => {
  useEffect(() => {
    const query = window.location.search;
    window.location.href = `${process.env.REACT_APP_API_URL}/login/oauth2/code/github${query}`;
  }, []);

  return <div>GitHub 인증 처리 중...</div>;
};

export default RedirectToBackend;
