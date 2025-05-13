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
        System.out.println("auth = " + authentication);
        return memberService.getMemberDetails(authentication);
    }

    @GetMapping("/details/{memberId}")
    public MemberResponse getMemberDetails(@PathVariable Long memberId) {
        return memberService.findMemberById(memberId);
    }
}
