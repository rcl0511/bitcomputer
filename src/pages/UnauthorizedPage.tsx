import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 text-center">
      <ShieldX className="h-14 w-14 text-red-400" />
      <h1 className="text-2xl font-bold text-gray-900">접근 권한이 없습니다</h1>
      <p className="text-sm text-gray-500">해당 페이지에 접근할 권한이 없습니다.</p>
      <Link
        to="/portal"
        className="mt-2 rounded-lg bg-[#004192] px-5 py-2 text-sm font-medium text-white hover:bg-[#003578] transition-colors"
      >
        내 포털로 이동
      </Link>
    </div>
  );
}
