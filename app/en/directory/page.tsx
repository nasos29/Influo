import DirectoryTopicLinks from "@/components/DirectoryTopicLinks";
import DirectoryMain from "../../directory/DirectoryMain";

export const revalidate = 3600;

export default async function EnDirectoryPage() {
  return (
    <>
      <DirectoryMain />
      <DirectoryTopicLinks lang="en" />
    </>
  );
}