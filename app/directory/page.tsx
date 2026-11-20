import DirectoryTopicLinks from "@/components/DirectoryTopicLinks";
import DirectoryMain from "./DirectoryMain";

export const revalidate = 3600;

export default async function DirectoryPage() {
  return (
    <>
      <DirectoryMain />
      <DirectoryTopicLinks lang="el" />
    </>
  );
}