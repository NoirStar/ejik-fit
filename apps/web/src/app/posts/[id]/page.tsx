import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ServerPostDetail } from "@/features/community/server-post-detail";
import { LocalPostDetail } from "@/features/home-feed/local-post-detail";
import { isCommunityUuid } from "@/lib/community-contract";
import { isLocalCommunityPostId } from "@/lib/local-community-posts";

type PostPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { id } = await params;
  if (isLocalCommunityPostId(id)) {
    const title = "이 기기에 남은 커뮤니티 글";
    const description =
      "작성했지만 계정에 게시되지 않아 이 기기에만 남아 있는 커뮤니티 글입니다.";
    return {
      title,
      description,
      alternates: { canonical: `/posts/${encodeURIComponent(id)}` },
      robots: { follow: false, index: false },
    };
  }
  if (isCommunityUuid(id)) {
    const title = "이직핏 커뮤니티 글";
    const description = "이직핏 사용자가 계정에 작성한 공개 커뮤니티 글입니다.";
    return {
      title,
      description,
      alternates: { canonical: `/posts/${encodeURIComponent(id)}` },
      robots: { follow: true, index: false },
    };
  }
  notFound();
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  if (isLocalCommunityPostId(id)) {
    return <LocalPostDetail postId={id} />;
  }
  if (isCommunityUuid(id)) {
    return <ServerPostDetail postId={id} />;
  }
  notFound();
}
