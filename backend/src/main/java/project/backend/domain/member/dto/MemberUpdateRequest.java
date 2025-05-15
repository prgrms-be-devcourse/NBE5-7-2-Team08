package project.backend.domain.member.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.Value;
import org.springframework.web.multipart.MultipartFile;

@Data
public class MemberUpdateRequest {

    @NotBlank(message = "비밀번호는 필수입니다.")
    @Size(min = 12, message = "비밀번호는 최소 12자 이상이여야 합니다.")
    private String password;
    private String nickname;
    private MultipartFile profileImg;

}
