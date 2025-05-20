package project.backend.domain.chat.github.test;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import project.backend.domain.chat.github.GitHubClient;

//@Component
@RequiredArgsConstructor
public class WebhookTestRunner implements CommandLineRunner {

    private final GitHubClient gitHubClient;
    @Value("${github.personal.access_token}")
    private String accessToken;

    @Override
    public void run(String... args) {
        String owner = "prgrms-be-devcourse";
        String repo = "NBE5-7-2-Team08";
        String webhookUrl = "https://fb34-220-116-231-187.ngrok-free.app/github/2";

        try {
            gitHubClient.registerWebhook(accessToken, owner, repo, webhookUrl);
            System.out.println("웹훅 등록 성공!");
        } catch (Exception e) {
            System.err.println("웹훅 등록 실패: " + e.getMessage());
        }
    }

}
