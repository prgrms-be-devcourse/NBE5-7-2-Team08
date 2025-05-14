package project.backend.domain.member.app;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import project.backend.domain.imagefile.ImageFile;
import project.backend.domain.imagefile.ImageFileService;
import project.backend.domain.member.dao.MemberRepository;
import project.backend.domain.member.dto.MemberDetails;
import project.backend.domain.member.dto.MemberResponse;
import project.backend.domain.member.dto.MemberUpdateRequest;
import project.backend.domain.member.dto.SignUpRequest;
import project.backend.domain.member.entity.Member;
import project.backend.domain.member.mapper.MemberMapper;
import project.backend.global.exception.errorcode.MemberErrorCode;
import project.backend.global.exception.ex.MemberException;

import java.util.Optional;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class MemberService {

    private final MemberRepository memberRepository;
    private final ImageFileService imageFileService;
    private final PasswordEncoder passwordEncoder;

    @Value("${file.default-profile}")
    private String defaultProfilePath;

    public MemberResponse saveMember(SignUpRequest request) {

        if (checkIfMemberExists(request.getEmail())) {
            log.info("예외 = {}", "이미 존재하는 email");
            throw new MemberException(MemberErrorCode.MEMBER_ALREADY_EXISTS);
        }

        ImageFile defaultProfileImg = imageFileService.getProfileImageByStoreFileName(defaultProfilePath);

        String encryptedPassword = passwordEncoder.encode(request.getPassword());

        Member newMember = memberRepository.save(
                MemberMapper.toEntity(request, encryptedPassword, defaultProfileImg));

        return MemberMapper.toResponse(newMember);
    }

    public MemberResponse getMemberDetails(Authentication auth) {
        MemberDetails loginMember = (MemberDetails) auth.getPrincipal();
        Long memberId = loginMember.getId();

        Member member = findMemberById(memberId);
        return MemberMapper.toResponse(member);
    }

    public MemberResponse returnMemberById(Long memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new MemberException(MemberErrorCode.MEMBER_NOT_FOUND));

        return MemberMapper.toResponse(member);
    }


    private boolean checkIfMemberExists(String email) {
        return memberRepository.findByEmail(email).isPresent();
    }

    public Member loginByEmail(String email) {
        try {
            return findMemberByEmail(email);
        } catch (MemberException e) {
            log.info("존재하지 않는 유저");
            throw new UsernameNotFoundException("존재하지 않는 유저입니다.");
        }
    }

    public Member findMemberByEmail(String email) {

        return memberRepository.findByEmail(email)
                .orElseThrow(() -> new MemberException(MemberErrorCode.MEMBER_NOT_FOUND));
    }

    private Member findMemberById(Long id) {
        return memberRepository.findById(id)
                .orElseThrow(() -> new MemberException(MemberErrorCode.MEMBER_NOT_FOUND));
    }

    public MemberResponse updateMember(Authentication auth, MemberUpdateRequest request) {

        MemberDetails memberDetails = (MemberDetails) auth.getPrincipal();

        Member targetMember = findMemberById(memberDetails.getId());

        if (request.getNickname() != null) {
            targetMember.setNickname(request.getNickname());
        }

        if (request.getPassword() != null) {
            targetMember.setPassword(passwordEncoder.encode(request.getPassword()));
        }

        if (request.getProfileImg() != null) {
            ImageFile newProfile = imageFileService.saveProfileImageFile(request.getProfileImg());
            targetMember.setProfileImage(newProfile);
        }

        return MemberMapper.toResponse(targetMember);
    }

}
