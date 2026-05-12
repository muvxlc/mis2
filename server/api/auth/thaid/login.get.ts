import { getThaIDAuthUrl } from '../../../utils/thaid';

export default defineEventHandler(async (event) => {
  const url = getThaIDAuthUrl();
  return sendRedirect(event, url);
});
