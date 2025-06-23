import React, { useEffect } from 'react'
import AdminNavBar from '../../components/admin/AdminNavBar'
import AdminSideBar from '../../components/admin/AdminSideBar'
import { Outlet } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import Loading from '../../components/Loading'

const Layout = () => {

  const {isAdmin,fetchIsAdmin} = useAppContext();

  useEffect(()=>{
    fetchIsAdmin();
  },[])

  console.log("ADMIN",isAdmin)

  return isAdmin?(
    <>
      <AdminNavBar/>
      <div className='flex'>
        <AdminSideBar/>
        <div className='flex-1 px-4 py-10 md:px-10 h-[calc(100vh-64px)] overflow-y-auto'>
            <Outlet/>
        </div>
      </div>
    </>
  ):(
    <Loading/>
  )
}

export default Layout
