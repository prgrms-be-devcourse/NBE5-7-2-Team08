package project.backend.domain.member.api;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import project.backend.domain.member.app.MemberService;
import project.backend.domain.member.dto.MemberResponse;
import project.backend.domain.member.dto.MemberUpdateRequest;
import project.backend.domain.member.entity.Member;

@Slf4j
@RestController
@RequestMapping("/user")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    @GetMapping("/details")
    public MemberResponse getMemberDetails(Authentication authentication) {
        return memberService.getMemberDetails(authentication);
    }

    @PutMapping(value = "/update", consumes = "multipart/form-data")
    public MemberResponse updateMemberDetails(Authentication authentication, @ModelAttribute MemberUpdateRequest updateRequest) {
        log.info("updateMemberDetails");
        return memberService.updateMember(authentication, updateRequest);
    }

    //사용안함 추후에 사용 가능 (edit profile)을 안보여주는 유저 정보 페이지 띄울때
    @Deprecated()
    @GetMapping("/details/{memberId}")
    public MemberResponse getMemberDetails(@PathVariable Long memberId, Authentication authentication) {
        return memberService.returnMemberById(memberId);
    }
}
