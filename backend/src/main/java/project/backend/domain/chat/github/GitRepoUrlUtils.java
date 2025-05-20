package project.backend.domain.chat.github;

import java.net.URI;
import java.net.URISyntaxException;
import project.backend.domain.chat.github.dto.GitRepoDto;
import project.backend.global.exception.errorcode.GitHubErrorCode;
import project.backend.global.exception.ex.GitHubException;

public class GitRepoUrlUtils {

    public static GitRepoDto validateAndParseUrl(String url) {
        try {
            URI uri = new URI(url);

            // 1. 도메인 체크
            if (!"github.com".equals(uri.getHost())) {
                throw new GitHubException(GitHubErrorCode.INVALID_REPO_RUL);
            }

            // 2. 경로 세그먼트 체크
            String[] segments = uri.getPath().split("/");

            if (segments.length != 3 || segments[1].isBlank() || segments[2].isBlank()) {
                throw new GitHubException(GitHubErrorCode.INVALID_REPO_RUL);
            }

            return new GitRepoDto(segments[1], segments[2]);

        } catch (URISyntaxException e) {
            throw new GitHubException(GitHubErrorCode.INVALID_REPO_RUL);
        }
    }
}
