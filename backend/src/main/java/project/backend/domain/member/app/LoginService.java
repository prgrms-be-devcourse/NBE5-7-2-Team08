package project.backend.domain.member.app;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.backend.global.config.security.dto.MemberDetails;
import project.backend.domain.member.entity.Member;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class LoginService implements UserDetailsService {

    private final MemberService memberService;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        Member foundMember = memberService.loginByEmail(email);
        log.info("로그인 시도 = {}", foundMember);
        return new MemberDetails(foundMember);
    }
}
