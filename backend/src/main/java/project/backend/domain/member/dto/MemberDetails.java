package project.backend.domain.member.dto;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import project.backend.domain.member.entity.Member;

import java.util.Collection;
import java.util.List;

@Getter
public class MemberDetails implements UserDetails {

    private final String email;
    private final String password;
    private final String nickname;

    public MemberDetails(Member member) {
        this.email = member.getEmail();
        this.password = member.getPassword();
        this.nickname = member.getNickname();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_USER"));
    }

    @Override
    public String getUsername() {
        return this.email;
    }
}
