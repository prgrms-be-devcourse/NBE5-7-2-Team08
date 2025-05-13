package project.backend;

import static org.assertj.core.api.AssertionsForClassTypes.assertThat;
import static org.assertj.core.api.AssertionsForClassTypes.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import java.util.Optional;

import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import project.backend.domain.imagefile.ImageFile;
import project.backend.domain.imagefile.ImageFileService;
import project.backend.domain.member.app.MemberService;
import project.backend.domain.member.dao.MemberRepository;
import project.backend.domain.member.dto.MemberResponse;
import project.backend.domain.member.dto.SignUpRequest;
import project.backend.domain.member.entity.Member;
import project.backend.domain.member.mapper.MemberMapper;
import project.backend.global.exception.ex.MemberException;

@Slf4j
@ExtendWith(MockitoExtension.class)
public class MemberServiceTests {

    @InjectMocks
    private MemberService memberService;

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private ImageFileService imageFileService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Test
    @DisplayName("Member 저장 성공 테스트")
    void saveMemberSuccess() throws Exception {
        //given
        SignUpRequest request = new SignUpRequest();
        request.setEmail("test@test.com");
        request.setPassword("password");
        request.setNickname("nickname");

        ImageFile dummyImage = ImageFile.builder()
                .imageId(1L)
                .uploadFileName("profile.jpg")
                .storeFileName("stored-profile.jpg")
                .build();

        Member member = Member.builder()
                .id(1L)
                .email("test@test.com")
                .password("password")
                .nickname("nickname")
                .profileImage(dummyImage)
                .build();

        when(memberRepository.findByEmail(request.getEmail())).thenReturn(Optional.empty());
        when(memberRepository.save(Mockito.<Member>any())).thenReturn(member);

        //when
        MemberResponse response = memberService.saveMember(request);

        //then
        assertThat(response.getEmail()).isEqualTo("test@test.com");
        log.info("response.getEmail() = {}", response.getEmail());
        assertThat(response.getNickname()).isEqualTo("nickname");
        log.info("response.getNickname() = {}", response.getNickname());
    }

    @Test
    @DisplayName("Member 저장 시 이미존재하는 이메일로 인한 실패 테스트")
    void saveMemberFailByME001() throws Exception {
        //given
        SignUpRequest request = new SignUpRequest();
        request.setEmail("already@test.com");
        request.setPassword("password");
        request.setNickname("nickname");

        Member existing = Member.builder()
                .id(1L)
                .email("already@test.com")
                .password("password")
                .nickname("nickname")
                .build();

        when(memberRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(existing));

        //when & then
        assertThrows(MemberException.class, () -> memberService.saveMember(request));

        assertThatThrownBy(() -> memberService.saveMember(request))
                .isInstanceOf(MemberException.class)
                .hasMessageContaining("이미 사용 중인 이메일입니다.");
    }

    @Test
    @DisplayName("Member email로 찾기 성공 테스트")
    void findMemberByEmailSuccess() throws Exception {
        //given
        String targetEmail = "test@test.com";

        ImageFile dummyImage = ImageFile.builder()
                .imageId(1L)
                .uploadFileName("profile.jpg")
                .storeFileName("stored-profile.jpg")
                .build();

        Member member = Member.builder()
                .id(1L)
                .email(targetEmail)
                .password("password")
                .nickname("nickname")
                .profileImage(dummyImage)
                .build();

        when(memberRepository.findByEmail(targetEmail)).thenReturn(Optional.of(member));

        //when
        MemberResponse response = MemberMapper.toResponse(memberService.findMemberByEmail(targetEmail));

        //then
        assertThat(response.getEmail()).isEqualTo(targetEmail);
        assertThat(response.getNickname()).isEqualTo("nickname");
        assertThat(response.getId()).isEqualTo(1L);
    }


    @Test
    @DisplayName("Member email로 찾기 실패 테스트")
    void findMemberByEmailFail() throws Exception {
        //given
        String targetEmail = "already@test.com";
        when(memberRepository.findByEmail(targetEmail)).thenReturn(Optional.empty());

        //when&then
        assertThatThrownBy(() -> memberService.findMemberByEmail(targetEmail))
                .isInstanceOf(UsernameNotFoundException.class);
    }
}
