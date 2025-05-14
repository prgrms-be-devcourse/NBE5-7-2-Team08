package project.backend.domain.member.api;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import project.backend.domain.member.app.MemberService;
import project.backend.domain.member.dto.MemberResponse;
import project.backend.domain.member.entity.Member;

@RestController
@RequestMapping("/user")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    @GetMapping("/details")
    public MemberResponse getMemberDetails(Authentication authentication) {
        return memberService.getMemberDetails(authentication);
    }

    //사용안함 추후에 사용 가능 (edit profile)을 안보여주는 유저 정보 페이지 띄울때
    @Deprecated()
    @GetMapping("/details/{memberId}")
    public MemberResponse getMemberDetails(@PathVariable Long memberId, Authentication authentication) {
        return memberService.findMemberById(memberId);
    }
}
